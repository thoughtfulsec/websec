import jwt from 'jsonwebtoken';
import { createVerify } from 'crypto';

/**
 * JWT verification result
 */
export interface JWTVerificationResult {
  isValid: boolean;
  token?: string;
  error?: string;
}

/**
 * Convert JWT signature from IEEE P1363 format to DER format
 * JWT uses raw r and s values concatenated (IEEE P1363)
 * Node.js crypto.verify expects DER format
 *
 * For ES256 (P-256), r and s are each 32 bytes (256 bits)
 * For secp256k1, r and s are also each 32 bytes
 *
 * @param signature - Signature in IEEE P1363 format
 * @returns Signature in DER format
 */
function ieee1363ToDer(signature: Buffer): Buffer {
  const len = signature.length / 2;
  const r = signature.subarray(0, len);
  const s = signature.subarray(len);

  // Helper to encode an integer in DER format
  function encodeInteger(int: Buffer): Buffer {
    // If the high bit is set, prepend 0x00 to indicate positive number
    const needsPadding = int[0] & 0x80;
    const paddedInt = needsPadding ? Buffer.concat([Buffer.from([0x00]), int]) : int;

    // Remove leading zeros (but keep at least one byte)
    let i = 0;
    while (i < paddedInt.length - 1 && paddedInt[i] === 0x00 && !(paddedInt[i + 1] & 0x80)) {
      i++;
    }
    const trimmedInt = paddedInt.subarray(i);

    // DER integer: 0x02 (INTEGER tag) + length + value
    return Buffer.concat([
      Buffer.from([0x02, trimmedInt.length]),
      trimmedInt
    ]);
  }

  const rDer = encodeInteger(r);
  const sDer = encodeInteger(s);

  // DER sequence: 0x30 (SEQUENCE tag) + length + r + s
  const derSignature = Buffer.concat([rDer, sDer]);
  return Buffer.concat([
    Buffer.from([0x30, derSignature.length]),
    derSignature
  ]);
}

/**
 * Manually verify JWT signature using Node.js crypto
 * This works with any elliptic curve, including secp256k1
 * Used as a fallback when jwt.verify() fails due to curve mismatch
 *
 * @param token - JWT token string
 * @param publicKeyPem - PEM-formatted public key
 * @returns true if signature is valid, false otherwise
 */
function manuallyVerifyJWTSignature(token: string, publicKeyPem: string): boolean {
  try {
    // Split JWT into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // The signed message is header.payload
    const message = `${headerB64}.${payloadB64}`;

    // Decode signature from base64url to buffer
    const signatureBase64 = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const signatureIEEE = Buffer.from(signatureBase64, 'base64');

    // Convert signature from IEEE P1363 to DER format
    const signatureDER = ieee1363ToDer(signatureIEEE);

    // Create verifier with SHA-256 (ES256 uses SHA-256)
    const verifier = createVerify('SHA256');
    verifier.update(message);

    // Verify signature
    return verifier.verify(publicKeyPem, signatureDER);
  } catch (error) {
    return false;
  }
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
 * Implements a fallback strategy:
 * 1. First attempts standard jwt.verify() with ES256
 * 2. If that fails with a curve mismatch error, attempts manual verification
 *    (this handles secp256k1 keys that are non-standard for ES256)
 * 3. For all other errors, returns false
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
    // Check if this is a curve mismatch error (e.g., secp256k1 vs P-256)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isCurveMismatch = errorMessage.includes('requires curve');

    if (isCurveMismatch) {
      // Attempt manual verification as fallback for non-standard curves
      return manuallyVerifyJWTSignature(token, publicKey);
    }

    // For all other errors (invalid signature, malformed token, etc.), return false
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

