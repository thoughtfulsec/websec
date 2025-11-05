#!/usr/bin/env ts-node
/**
 * Debug script to test JWT verification
 */

import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { extractAndVerifyJWT } from '../src/utils/jwt-verification';

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const JWT_PRIVATE_KEY_DEV = process.env.JWT_PRIVATE_KEY_DEV || '';
const JWT_PUBLIC_KEY_DEV = process.env.JWT_PUBLIC_KEY_DEV || '';
const JWT_PUBLIC_KEY_PROD = process.env.JWT_PUBLIC_KEY_PROD || '';

console.log('🔍 JWT Verification Debug Script\n');

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

