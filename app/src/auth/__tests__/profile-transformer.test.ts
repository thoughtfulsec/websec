import { describe, it, expect } from 'vitest';
import { Profile } from 'passport-google-oauth20';
import { transformGoogleProfile, SessionUser } from '../passport-config';

describe('transformGoogleProfile', () => {
  describe('complete Google profile', () => {
    it('should transform a complete profile with all fields', () => {
      // Arrange: Create a complete Google profile
      const googleProfile: Profile = {
        id: 'google-user-123',
        displayName: 'John Doe',
        name: {
          familyName: 'Doe',
          givenName: 'John',
        },
        emails: [
          { value: 'john.doe@example.com', verified: true },
        ],
        photos: [
          { value: 'https://example.com/photo.jpg' },
        ],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act: Transform the profile
      const result = transformGoogleProfile(googleProfile);

      // Assert: All fields should be correctly extracted
      expect(result).toEqual({
        id: 'google-user-123',
        email: 'john.doe@example.com',
        displayName: 'John Doe',
        photo: 'https://example.com/photo.jpg',
      });
    });

    it('should use the first email when multiple emails are present', () => {
      // Arrange: Profile with multiple emails
      const googleProfile: Profile = {
        id: 'google-user-456',
        displayName: 'Jane Smith',
        emails: [
          { value: 'jane.primary@example.com', verified: true },
          { value: 'jane.secondary@example.com', verified: false },
        ],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: Should use first email
      expect(result.email).toBe('jane.primary@example.com');
    });

    it('should use the first photo when multiple photos are present', () => {
      // Arrange: Profile with multiple photos
      const googleProfile: Profile = {
        id: 'google-user-789',
        displayName: 'Bob Johnson',
        photos: [
          { value: 'https://example.com/photo-primary.jpg' },
          { value: 'https://example.com/photo-secondary.jpg' },
        ],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: Should use first photo
      expect(result.photo).toBe('https://example.com/photo-primary.jpg');
    });
  });

  describe('missing optional fields', () => {
    it('should handle missing emails array', () => {
      // Arrange: Profile without emails
      const googleProfile: Profile = {
        id: 'google-user-no-email',
        displayName: 'No Email User',
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: Email should default to empty string
      expect(result.email).toBe('');
      expect(result.id).toBe('google-user-no-email');
      expect(result.displayName).toBe('No Email User');
    });

    it('should handle empty emails array', () => {
      // Arrange: Profile with empty emails array
      const googleProfile: Profile = {
        id: 'google-user-empty-emails',
        displayName: 'Empty Emails User',
        emails: [],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: Email should default to empty string
      expect(result.email).toBe('');
    });

    it('should handle missing photos array', () => {
      // Arrange: Profile without photos
      const googleProfile: Profile = {
        id: 'google-user-no-photo',
        displayName: 'No Photo User',
        emails: [{ value: 'user@example.com', verified: true }],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: Photo should be undefined
      expect(result.photo).toBeUndefined();
      expect(result.email).toBe('user@example.com');
    });

    it('should handle empty photos array', () => {
      // Arrange: Profile with empty photos array
      const googleProfile: Profile = {
        id: 'google-user-empty-photos',
        displayName: 'Empty Photos User',
        photos: [],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: Photo should be undefined
      expect(result.photo).toBeUndefined();
    });

    it('should handle missing displayName', () => {
      // Arrange: Profile without displayName
      const googleProfile: Profile = {
        id: 'google-user-no-name',
        displayName: undefined as any,
        emails: [{ value: 'user@example.com', verified: true }],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: displayName should default to empty string
      expect(result.displayName).toBe('');
      expect(result.email).toBe('user@example.com');
    });

    it('should handle empty string displayName', () => {
      // Arrange: Profile with empty displayName
      const googleProfile: Profile = {
        id: 'google-user-empty-name',
        displayName: '',
        emails: [{ value: 'user@example.com', verified: true }],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: Empty displayName should be preserved (falsy check)
      expect(result.displayName).toBe('');
    });
  });

  describe('edge cases and data validation', () => {
    it('should handle profile with only required id field', () => {
      // Arrange: Minimal profile with only ID
      const googleProfile: Profile = {
        id: 'minimal-user-id',
        provider: 'google',
        _raw: '',
        _json: {} as any,
      } as Profile;

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: Should create valid SessionUser with defaults
      expect(result).toEqual({
        id: 'minimal-user-id',
        email: '',
        displayName: '',
        photo: undefined,
      });
    });

    it('should handle email object without value property', () => {
      // Arrange: Malformed email object
      const googleProfile: Profile = {
        id: 'google-user-malformed',
        displayName: 'Malformed Email User',
        emails: [{ value: undefined } as any],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: Should handle gracefully
      expect(result.email).toBe('');
    });

    it('should handle photo object without value property', () => {
      // Arrange: Malformed photo object
      const googleProfile: Profile = {
        id: 'google-user-malformed-photo',
        displayName: 'Malformed Photo User',
        photos: [{ value: undefined } as any],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: Should handle gracefully
      expect(result.photo).toBeUndefined();
    });

    it('should preserve special characters in email', () => {
      // Arrange: Email with special characters
      const googleProfile: Profile = {
        id: 'google-user-special',
        displayName: 'Special User',
        emails: [{ value: 'user+tag@sub-domain.example.com', verified: true }],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: Email should be preserved exactly
      expect(result.email).toBe('user+tag@sub-domain.example.com');
    });

    it('should preserve special characters in displayName', () => {
      // Arrange: displayName with special characters
      const googleProfile: Profile = {
        id: 'google-user-unicode',
        displayName: 'José García-López',
        emails: [{ value: 'jose@example.com', verified: true }],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: displayName should be preserved exactly
      expect(result.displayName).toBe('José García-López');
    });

    it('should handle very long displayName', () => {
      // Arrange: Very long displayName
      const longName = 'A'.repeat(500);
      const googleProfile: Profile = {
        id: 'google-user-long-name',
        displayName: longName,
        emails: [{ value: 'user@example.com', verified: true }],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result = transformGoogleProfile(googleProfile);

      // Assert: Should preserve long name
      expect(result.displayName).toBe(longName);
      expect(result.displayName.length).toBe(500);
    });

    it('should handle HTTPS and HTTP photo URLs', () => {
      // Arrange: Different URL schemes
      const profiles = [
        { url: 'https://secure.example.com/photo.jpg', scheme: 'HTTPS' },
        { url: 'http://insecure.example.com/photo.jpg', scheme: 'HTTP' },
      ];

      profiles.forEach(({ url, scheme }) => {
        const googleProfile: Profile = {
          id: `user-${scheme}`,
          displayName: 'User',
          photos: [{ value: url }],
          provider: 'google',
          _raw: '',
          _json: {} as any,
        };

        // Act
        const result = transformGoogleProfile(googleProfile);

        // Assert: URL should be preserved
        expect(result.photo).toBe(url);
      });
    });
  });

  describe('type safety', () => {
    it('should return SessionUser type with correct structure', () => {
      // Arrange
      const googleProfile: Profile = {
        id: 'type-check-user',
        displayName: 'Type Check User',
        emails: [{ value: 'typecheck@example.com', verified: true }],
        photos: [{ value: 'https://example.com/photo.jpg' }],
        provider: 'google',
        _raw: '',
        _json: {} as any,
      };

      // Act
      const result: SessionUser = transformGoogleProfile(googleProfile);

      // Assert: Type structure validation
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('displayName');
      expect(result).toHaveProperty('photo');
      expect(typeof result.id).toBe('string');
      expect(typeof result.email).toBe('string');
      expect(typeof result.displayName).toBe('string');
      // photo can be string or undefined
      expect(['string', 'undefined']).toContain(typeof result.photo);
    });
  });
});

