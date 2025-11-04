import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ensureAuthenticated } from '../middleware';

describe('ensureAuthenticated middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset mocks before each test
    mockRequest = {
      path: '/secure',
      isAuthenticated: vi.fn(),
    };

    mockResponse = {
      redirect: vi.fn(),
    };

    mockNext = vi.fn();

    // Spy on console.log to verify logging behavior
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.log after each test
    consoleLogSpy.mockRestore();
  });

  describe('when user is authenticated', () => {
    it('should call next() and allow access', () => {
      // Arrange: User is authenticated
      (mockRequest.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(true);

      // Act: Call middleware
      ensureAuthenticated(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert: Should proceed to route handler
      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockResponse.redirect).not.toHaveBeenCalled();
    });

    it('should not redirect when authenticated', () => {
      // Arrange
      (mockRequest.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(true);

      // Act
      ensureAuthenticated(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert: No redirect should occur
      expect(mockResponse.redirect).not.toHaveBeenCalled();
    });

    it('should not log security warning when authenticated', () => {
      // Arrange
      (mockRequest.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(true);

      // Act
      ensureAuthenticated(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert: No security log should be generated
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('when user is not authenticated', () => {
    it('should redirect to /auth/google', () => {
      // Arrange: User is NOT authenticated
      (mockRequest.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(false);

      // Act: Call middleware
      ensureAuthenticated(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert: Should redirect to Google OAuth
      expect(mockResponse.redirect).toHaveBeenCalledWith('/auth/google');
      expect(mockResponse.redirect).toHaveBeenCalledOnce();
    });

    it('should NOT call next() when unauthenticated', () => {
      // Arrange
      (mockRequest.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(false);

      // Act
      ensureAuthenticated(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert: Should NOT proceed to route handler
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log the attempted path for security monitoring', () => {
      // Arrange
      mockRequest.path = '/secure/admin';
      (mockRequest.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(false);

      // Act
      ensureAuthenticated(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert: Should log security event with attempted path
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('/secure/admin')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unauthenticated access attempt')
      );
    });

    it('should log redirect to /auth/google', () => {
      // Arrange
      (mockRequest.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(false);

      // Act
      ensureAuthenticated(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert: Log should mention redirect destination
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('/auth/google')
      );
    });
  });

  describe('edge cases', () => {
    it('should handle different protected paths correctly', () => {
      // Test various protected paths
      const paths = ['/secure', '/secure/admin', '/secure/profile', '/api/protected'];

      paths.forEach((path) => {
        // Reset mocks
        vi.clearAllMocks();
        mockRequest.path = path;
        (mockRequest.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(false);

        // Act
        ensureAuthenticated(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        // Assert: Should redirect for all paths
        expect(mockResponse.redirect).toHaveBeenCalledWith('/auth/google');
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining(path)
        );
      });
    });

    it('should handle missing path gracefully', () => {
      // Arrange: Request without path property
      delete mockRequest.path;
      (mockRequest.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(false);

      // Act: Should not throw error
      expect(() => {
        ensureAuthenticated(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );
      }).not.toThrow();

      // Assert: Should still redirect
      expect(mockResponse.redirect).toHaveBeenCalledWith('/auth/google');
    });

    it('should handle isAuthenticated returning falsy values', () => {
      // Test various falsy values
      const falsyValues = [false, null, undefined, 0, ''];

      falsyValues.forEach((falsyValue) => {
        // Reset mocks
        vi.clearAllMocks();
        (mockRequest.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(falsyValue as any);

        // Act
        ensureAuthenticated(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        // Assert: Should redirect for all falsy values
        expect(mockResponse.redirect).toHaveBeenCalledWith('/auth/google');
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe('security regression prevention', () => {
    it('should NEVER call both next() and redirect()', () => {
      // Test authenticated case
      (mockRequest.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(true);
      ensureAuthenticated(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.redirect).not.toHaveBeenCalled();

      // Reset and test unauthenticated case
      vi.clearAllMocks();
      (mockRequest.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(false);
      ensureAuthenticated(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );
      expect(mockResponse.redirect).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should always check authentication before allowing access', () => {
      // Arrange
      (mockRequest.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValue(true);

      // Act
      ensureAuthenticated(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert: isAuthenticated must be called
      expect(mockRequest.isAuthenticated).toHaveBeenCalled();
    });
  });
});

