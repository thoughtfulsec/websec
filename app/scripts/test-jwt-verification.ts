#!/usr/bin/env ts-node
/**
 * Debug script to test JWT verification
 */

import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createPublicKey, createVerify } from 'crypto';
import { extractAndVerifyJWT } from '../src/utils/jwt-verification';

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const JWT_PRIVATE_KEY_DEV = process.env.JWT_PRIVATE_KEY_DEV || '';
const JWT_PUBLIC_KEY_DEV = process.env.JWT_PUBLIC_KEY_DEV || '';
const JWT_PUBLIC_KEY_PROD = process.env.JWT_PUBLIC_KEY_PROD || '';

/**
 * Convert JWT signature from IEEE P1363 format to DER format
 * JWT uses raw r and s values concatenated (IEEE P1363)
 * Node.js crypto.verify expects DER format
 *
 * For ES256 (P-256), r and s are each 32 bytes (256 bits)
 * For secp256k1, r and s are also each 32 bytes
 */
function ieee1363ToDer(signature: Buffer): Buffer {
  const len = signature.length / 2;
  const r = signature.slice(0, len);
  const s = signature.slice(len);

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
    const trimmedInt = paddedInt.slice(i);

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
 */
function manuallyVerifyJWT(token: string, publicKeyPem: string): boolean {
  try {
    // Split JWT into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('  ❌ Invalid JWT format: expected 3 parts');
      return false;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // The signed message is header.payload
    const message = `${headerB64}.${payloadB64}`;

    // Decode signature from base64url to buffer
    const signatureBase64 = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const signatureIEEE = Buffer.from(signatureBase64, 'base64');

    console.log('  Signature length (IEEE P1363):', signatureIEEE.length, 'bytes');

    // Convert signature from IEEE P1363 to DER format
    const signatureDER = ieee1363ToDer(signatureIEEE);
    console.log('  Signature length (DER):', signatureDER.length, 'bytes');

    // Create verifier with SHA-256 (ES256 uses SHA-256)
    const verifier = createVerify('SHA256');
    verifier.update(message);

    // Verify signature
    const isValid = verifier.verify(publicKeyPem, signatureDER);

    return isValid;
  } catch (error) {
    console.log('  ❌ Manual verification error:', error);
    return false;
  }
}

console.log('🔍 JWT Verification Debug Script\n');

// Debug: Show the public key format
console.log('JWT_PUBLIC_KEY_PROD:');
console.log(JWT_PUBLIC_KEY_PROD);
console.log('\nKey length:', JWT_PUBLIC_KEY_PROD.length);

// Use Node.js crypto to inspect the key
try {
  const keyObject = createPublicKey(JWT_PUBLIC_KEY_PROD);
  const keyDetails = keyObject.export({ format: 'jwk' }) as any;
  console.log('\nKey details (JWK format):');
  console.log('  crv (curve):', keyDetails.crv);
  console.log('  kty (key type):', keyDetails.kty);
  console.log('\n⚠️  PROBLEM IDENTIFIED:');
  console.log('  ES256 requires curve: P-256 (prime256v1)');
  console.log('  Your key uses curve:', keyDetails.crv);
  if (keyDetails.crv !== 'P-256') {
    console.log('\n  ❌ CURVE MISMATCH! This is why jwt.verify() fails.');
    console.log('  The production key was generated with the wrong curve.');
    console.log('  However, we can still verify it manually...');
  }
} catch (e) {
  console.log('Error inspecting key:', e);
}
console.log('\n');

// this is a known-good token from production
const prodtoken = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMjMsImlhdCI6MTczODQ2NzYwNn0.RY9VlEuVMeNUvopItg6iiKEqxWJF9pNMEWZg98ypSl-8gygsmq-rAoPM-Bx4BSb2dFhU8CIOsmzWrhqA4Fy0iQ"

console.log('═══════════════════════════════════════════════════════════');
console.log('Test 1: jwt.verify() with PROD key (will fail due to curve)');
console.log('═══════════════════════════════════════════════════════════');
try {
  jwt.verify(prodtoken, JWT_PUBLIC_KEY_PROD, { algorithms: ['ES256'] });
  console.log('✅ Direct verification with PROD key: SUCCESS\n');
} catch (error) {
  console.log('❌ Direct verification with PROD key: FAILED');
  console.log(`Error: ${error}\n`);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('Test 2: Manual verification with PROD key (secp256k1)');
console.log('═══════════════════════════════════════════════════════════');
const manualResult = manuallyVerifyJWT(prodtoken, JWT_PUBLIC_KEY_PROD);
if (manualResult) {
  console.log('✅ Manual verification with PROD key: SUCCESS');
  console.log('   The JWT signature is cryptographically valid!');
  console.log('   The token was correctly signed with the secp256k1 private key.');
} else {
  console.log('❌ Manual verification with PROD key: FAILED');
  console.log('   The signature does not match the public key.');
}
console.log('');

console.log('═══════════════════════════════════════════════════════════');
console.log('Test 3: Production code with fallback (verifyJWTSignature)');
console.log('═══════════════════════════════════════════════════════════');
import { verifyJWTSignature } from '../src/utils/jwt-verification';
const prodCodeResult = verifyJWTSignature(prodtoken, JWT_PUBLIC_KEY_PROD);
if (prodCodeResult) {
  console.log('✅ Production verifyJWTSignature() with PROD key: SUCCESS');
  console.log('   The fallback verification strategy works!');
  console.log('   jwt.verify() failed due to curve mismatch, but manual verification succeeded.');
} else {
  console.log('❌ Production verifyJWTSignature() with PROD key: FAILED');
  console.log('   The fallback strategy did not work as expected.');
}
console.log('');

console.log('═══════════════════════════════════════════════════════════');
console.log('Test 4: Generate and verify a development test token against the dev key');
console.log('═══════════════════════════════════════════════════════════');

// Step 1: Generate a test JWT
console.log('Step 1: Generating test JWT...');
const payload = { test: true, message: 'Debug test' };
const token = jwt.sign(payload, JWT_PRIVATE_KEY_DEV, { algorithm: 'ES256' });
console.log(`✅ Generated token: ${token.substring(0, 50)}...\n`);

// Step 2: Verify with the public key directly
console.log('Step 2: Verifying with jwt.verify() directly...');
try {
  jwt.verify(token, JWT_PUBLIC_KEY_DEV, { algorithms: ['ES256'] });
  console.log('✅ Direct verification with DEV key: SUCCESS\n');
} catch (error) {
  console.log('❌ Direct verification with DEV key: FAILED');
  console.log(`Error: ${error}\n`);
}

// Step 3: Test our extraction and verification function
console.log('Step 3: Testing extractAndVerifyJWT()...');
console.log(`isDevelopment: true`);
console.log(`JWT_PUBLIC_KEY_PROD length: ${JWT_PUBLIC_KEY_PROD.length}`);
console.log(`JWT_PUBLIC_KEY_DEV length: ${JWT_PUBLIC_KEY_DEV.length}`);
console.log('');

const result = extractAndVerifyJWT(
  token,
  JWT_PUBLIC_KEY_PROD,
  JWT_PUBLIC_KEY_DEV,
  true // isDevelopment
);

console.log('Result:', result);
console.log('');

if (result.isValid) {
  console.log('✅ extractAndVerifyJWT: SUCCESS');
} else {
  console.log('❌ extractAndVerifyJWT: FAILED');
  console.log(`Error: ${result.error}`);
}

// Step 4: Test with text containing JWT
console.log('\nStep 4: Testing with text containing JWT...');
const textWithJWT = `Here is my token: ${token}`;
const result2 = extractAndVerifyJWT(
  textWithJWT,
  JWT_PUBLIC_KEY_PROD,
  JWT_PUBLIC_KEY_DEV,
  true
);

console.log('Result:', result2);
if (result2.isValid) {
  console.log('✅ Text extraction and verification: SUCCESS');
} else {
  console.log('❌ Text extraction and verification: FAILED');
  console.log(`Error: ${result2.error}`);
}

// Step 5: Show key formats
console.log('\n\nStep 5: Key format inspection...');
console.log('JWT_PUBLIC_KEY_DEV:');
console.log(JWT_PUBLIC_KEY_DEV);
console.log('\nJWT_PRIVATE_KEY_DEV:');
console.log(JWT_PRIVATE_KEY_DEV);

