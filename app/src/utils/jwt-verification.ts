import jwt from 'jsonwebtoken';

/**
 * JWT verification result
 */
export interface JWTVerificationResult {
  isValid: boolean;
  token?: string;
  error?: string;
}

/**
 * Extract JWT token from input string using regex
 * Looks for standard JWT format: xxx.yyy.zzz (3 base64url parts separated by dots)
 * 
 * @param input - Input string that may contain a JWT token
 * @returns JWT token string if found, null otherwise
 */
export function extractJWTFromInput(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // JWT regex: matches 3 base64url-encoded parts separated by dots
  // Base64url characters: A-Z, a-z, 0-9, -, _
  const jwtRegex = /[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
  const match = input.match(jwtRegex);
  
  return match ? match[0] : null;
}

/**
 * Verify JWT signature using ES256 algorithm
 * Only validates the signature, NOT claims like exp, iss, etc.
 * 
 * @param token - JWT token string to verify
 * @param publicKey - PEM-formatted public key for verification
 * @returns true if signature is valid, false otherwise
 */
export function verifyJWTSignature(token: string, publicKey: string): boolean {
  if (!token || !publicKey) {
    return false;
  }

  try {
    // Verify signature using ES256 algorithm
    // ignoreExpiration and ignoreNotBefore: we only care about signature, not claims
    jwt.verify(token, publicKey, {
      algorithms: ['ES256'],
      ignoreExpiration: true,
      ignoreNotBefore: true,
      // Don't validate any claims - only signature
      complete: false,
    });
    
    return true;
  } catch (error) {
    // Signature verification failed or token is malformed
    return false;
  }
}

/**
 * Extract and verify JWT from input string
 * Combines extraction and verification in one function
 * 
 * @param input - Input string that may contain a JWT token
 * @param publicKeyProd - Production public key (PEM format)
 * @param publicKeyDev - Development public key (PEM format)
 * @param isDevelopment - Whether running in development mode
 * @returns Verification result with isValid flag and optional token/error
 */
export function extractAndVerifyJWT(
  input: string,
  publicKeyProd: string,
  publicKeyDev: string,
  isDevelopment: boolean = false
): JWTVerificationResult {
  // Extract JWT from input
  const token = extractJWTFromInput(input);
  
  if (!token) {
    return {
      isValid: false,
      error: 'No JWT token found in input',
    };
  }

  // Try production key first
  const isValidProd = verifyJWTSignature(token, publicKeyProd);
  if (isValidProd) {
    return {
      isValid: true,
      token,
    };
  }

  // In development, also try dev key
  if (isDevelopment && publicKeyDev) {
    const isValidDev = verifyJWTSignature(token, publicKeyDev);
    if (isValidDev) {
      return {
        isValid: true,
        token,
      };
    }
  }

  return {
    isValid: false,
    token,
    error: 'JWT signature verification failed',
  };
}

