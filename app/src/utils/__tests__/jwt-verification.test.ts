import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  extractJWTFromInput,
  verifyJWTSignature,
  extractAndVerifyJWT,
} from '../jwt-verification';

// Test keys for ES256 (ECDSA P-256)
const TEST_PRIVATE_KEY = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIObxt6wDWhgftk1k4l72rKbhof3Re8qGLXQYSHn3vK2qoAoGCCqGSM49
AwEHoUQDQgAEXpObHSbmrnFW4raLG+2ZPGtmL9cooADtGaZelBs/mCpMujXbJ066
19DXuy4taxV64lC911lKdK38HBuclYnGeQ==
-----END EC PRIVATE KEY-----`;

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEXpObHSbmrnFW4raLG+2ZPGtmL9co
oADtGaZelBs/mCpMujXbJ06619DXuy4taxV64lC911lKdK38HBuclYnGeQ==
-----END PUBLIC KEY-----`;

// Different key pair for testing invalid signatures
const WRONG_PRIVATE_KEY = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIJKm8VqSvPXqLqKxPqPqPqPqPqPqPqPqPqPqPqPqPqPqoAoGCCqGSM49
AwEHoUQDQgAEqPqPqPqPqPqPqPqPqPqPqPqPqPqPqPqPqPqPqPqPqPqPqPqPqPqP
qPqPqPqPqPqPqPqPqPqPqPqPqPqPqPqPqA==
-----END EC PRIVATE KEY-----`;

let validToken: string;
let invalidSignatureToken: string;

beforeAll(() => {
  // Generate a valid JWT token for testing
  validToken = jwt.sign(
    { test: true, message: 'Valid test token' },
    TEST_PRIVATE_KEY,
    { algorithm: 'ES256' }
  );

  // Generate a token with wrong signature (signed with different key)
  // We'll manually create an invalid one by signing with a different algorithm
  const validTokenParts = validToken.split('.');
  const wrongPayload = jwt.sign(
    { test: true, message: 'Wrong signature' },
    'wrong-secret-key',
    { algorithm: 'HS256' }
  );
  // Create token with valid structure but invalid signature
  invalidSignatureToken = validTokenParts[0] + '.' + validTokenParts[1] + '.INVALIDSIGNATURE';
});

describe('extractJWTFromInput', () => {
  describe('valid JWT extraction', () => {
    it('should extract JWT from plain token string', () => {
      const result = extractJWTFromInput(validToken);
      expect(result).toBe(validToken);
    });

    it('should extract JWT from text with token at the beginning', () => {
      const input = `${validToken} some additional text`;
      const result = extractJWTFromInput(input);
      expect(result).toBe(validToken);
    });

    it('should extract JWT from text with token in the middle', () => {
      const input = `Some text before ${validToken} and after`;
      const result = extractJWTFromInput(input);
      expect(result).toBe(validToken);
    });

    it('should extract JWT from text with token at the end', () => {
      const input = `Here is my token: ${validToken}`;
      const result = extractJWTFromInput(input);
      expect(result).toBe(validToken);
    });

    it('should extract first JWT when multiple tokens present', () => {
      const token2 = jwt.sign({ test: 2 }, TEST_PRIVATE_KEY, { algorithm: 'ES256' });
      const input = `First: ${validToken} Second: ${token2}`;
      const result = extractJWTFromInput(input);
      expect(result).toBe(validToken);
    });
  });

  describe('no JWT found', () => {
    it('should return null for plain text without JWT', () => {
      const result = extractJWTFromInput('This is just plain text');
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = extractJWTFromInput('');
      expect(result).toBeNull();
    });

    it('should return null for malformed JWT (only 2 parts)', () => {
      const result = extractJWTFromInput('header.payload');
      expect(result).toBeNull();
    });

    it('should extract first 3 parts from 4-part string (regex matches first JWT-like pattern)', () => {
      // Note: Our regex will match the first 3 parts, which is acceptable
      // since we're looking for JWT patterns in arbitrary text
      const result = extractJWTFromInput('part1.part2.part3.part4');
      expect(result).toBe('part1.part2.part3');
    });

    it('should return null for null input', () => {
      const result = extractJWTFromInput(null as any);
      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = extractJWTFromInput(undefined as any);
      expect(result).toBeNull();
    });

    it('should return null for non-string input', () => {
      const result = extractJWTFromInput(12345 as any);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle JWT-like strings with invalid characters', () => {
      const result = extractJWTFromInput('header.pay load.signature');
      expect(result).toBeNull();
    });

    it('should extract JWT with URL-safe base64 characters', () => {
      // JWT uses base64url encoding which includes - and _
      const jwtLike = 'eyJhbGciOiJFUzI1NiJ9.eyJ0ZXN0Ijp0cnVlfQ.MEUCIQDabcdef-1234_ABCD';
      const result = extractJWTFromInput(jwtLike);
      expect(result).toBe(jwtLike);
    });
  });
});

describe('verifyJWTSignature', () => {
  describe('valid signature verification', () => {
    it('should verify valid JWT signature', () => {
      const result = verifyJWTSignature(validToken, TEST_PUBLIC_KEY);
      expect(result).toBe(true);
    });

    it('should verify JWT even if expired (ignoreExpiration)', () => {
      const expiredToken = jwt.sign(
        { test: true },
        TEST_PRIVATE_KEY,
        { algorithm: 'ES256', expiresIn: '-1h' } // Already expired
      );
      const result = verifyJWTSignature(expiredToken, TEST_PUBLIC_KEY);
      expect(result).toBe(true);
    });

    it('should verify JWT with various payload sizes', () => {
      const largePayload = {
        data: 'x'.repeat(1000),
        nested: { a: 1, b: 2, c: { d: 3 } },
      };
      const token = jwt.sign(largePayload, TEST_PRIVATE_KEY, { algorithm: 'ES256' });
      const result = verifyJWTSignature(token, TEST_PUBLIC_KEY);
      expect(result).toBe(true);
    });
  });

  describe('invalid signature verification', () => {
    it('should reject JWT with invalid signature', () => {
      const result = verifyJWTSignature(invalidSignatureToken, TEST_PUBLIC_KEY);
      expect(result).toBe(false);
    });

    it('should reject JWT signed with wrong key', () => {
      const wrongToken = jwt.sign(
        { test: true },
        'different-secret',
        { algorithm: 'HS256' }
      );
      const result = verifyJWTSignature(wrongToken, TEST_PUBLIC_KEY);
      expect(result).toBe(false);
    });

    it('should reject malformed JWT', () => {
      const result = verifyJWTSignature('not.a.valid.jwt', TEST_PUBLIC_KEY);
      expect(result).toBe(false);
    });

    it('should reject JWT with only 2 parts', () => {
      const result = verifyJWTSignature('header.payload', TEST_PUBLIC_KEY);
      expect(result).toBe(false);
    });

    it('should reject plain text', () => {
      const result = verifyJWTSignature('plain text', TEST_PUBLIC_KEY);
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false for empty token', () => {
      const result = verifyJWTSignature('', TEST_PUBLIC_KEY);
      expect(result).toBe(false);
    });

    it('should return false for empty public key', () => {
      const result = verifyJWTSignature(validToken, '');
      expect(result).toBe(false);
    });

    it('should return false for null token', () => {
      const result = verifyJWTSignature(null as any, TEST_PUBLIC_KEY);
      expect(result).toBe(false);
    });

    it('should return false for undefined token', () => {
      const result = verifyJWTSignature(undefined as any, TEST_PUBLIC_KEY);
      expect(result).toBe(false);
    });

    it('should return false for invalid public key format', () => {
      const result = verifyJWTSignature(validToken, 'invalid-public-key');
      expect(result).toBe(false);
    });
  });
});

describe('extractAndVerifyJWT', () => {
  describe('successful verification', () => {
    it('should extract and verify valid JWT from plain token', () => {
      const result = extractAndVerifyJWT(validToken, TEST_PUBLIC_KEY, '', false);
      expect(result.isValid).toBe(true);
      expect(result.token).toBe(validToken);
      expect(result.error).toBeUndefined();
    });

    it('should extract and verify JWT from text with surrounding content', () => {
      const input = `Check out this token: ${validToken} - it's valid!`;
      const result = extractAndVerifyJWT(input, TEST_PUBLIC_KEY, '', false);
      expect(result.isValid).toBe(true);
      expect(result.token).toBe(validToken);
    });

    it('should verify with production key', () => {
      const result = extractAndVerifyJWT(validToken, TEST_PUBLIC_KEY, '', false);
      expect(result.isValid).toBe(true);
    });

    it('should verify with dev key when in development mode', () => {
      const devToken = jwt.sign({ dev: true }, TEST_PRIVATE_KEY, { algorithm: 'ES256' });
      const result = extractAndVerifyJWT(
        devToken,
        'wrong-prod-key',
        TEST_PUBLIC_KEY,
        true // isDevelopment
      );
      expect(result.isValid).toBe(true);
    });

    it('should try production key first, then dev key', () => {
      const result = extractAndVerifyJWT(
        validToken,
        TEST_PUBLIC_KEY, // Prod key (will succeed)
        'different-dev-key',
        true
      );
      expect(result.isValid).toBe(true);
    });
  });

  describe('failed verification', () => {
    it('should fail when no JWT found in input', () => {
      const result = extractAndVerifyJWT('No token here', TEST_PUBLIC_KEY, '', false);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('No JWT token found in input');
      expect(result.token).toBeUndefined();
    });

    it('should fail when signature is invalid', () => {
      const result = extractAndVerifyJWT(invalidSignatureToken, TEST_PUBLIC_KEY, '', false);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('JWT signature verification failed');
      expect(result.token).toBe(invalidSignatureToken);
    });

    it('should fail when neither prod nor dev key verifies', () => {
      const result = extractAndVerifyJWT(
        validToken,
        'wrong-prod-key',
        'wrong-dev-key',
        true
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('JWT signature verification failed');
    });

    it('should not try dev key in production mode', () => {
      const result = extractAndVerifyJWT(
        validToken,
        'wrong-prod-key',
        TEST_PUBLIC_KEY, // Dev key would work, but shouldn't be tried
        false // Production mode
      );
      expect(result.isValid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const result = extractAndVerifyJWT('', TEST_PUBLIC_KEY, '', false);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('No JWT token found in input');
    });

    it('should handle null input', () => {
      const result = extractAndVerifyJWT(null as any, TEST_PUBLIC_KEY, '', false);
      expect(result.isValid).toBe(false);
    });

    it('should handle undefined input', () => {
      const result = extractAndVerifyJWT(undefined as any, TEST_PUBLIC_KEY, '', false);
      expect(result.isValid).toBe(false);
    });

    it('should handle missing dev key in development mode', () => {
      const result = extractAndVerifyJWT(
        validToken,
        'wrong-prod-key',
        '', // No dev key
        true
      );
      expect(result.isValid).toBe(false);
    });
  });
});

