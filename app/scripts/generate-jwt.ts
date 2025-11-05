#!/usr/bin/env ts-node
/**
 * JWT Generation Script for Local Development Testing
 * 
 * This script generates a valid JWT token signed with the local development
 * private key (ES256 algorithm). The generated token can be used to test
 * JWT signature verification in the application.
 * 
 * Usage:
 *   pnpm run generate-jwt
 * 
 * Requirements:
 *   - JWT_PRIVATE_KEY_DEV must be set in .env file
 *   - Only works in development environment (NODE_ENV !== 'production')
 */

import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const JWT_PRIVATE_KEY_DEV = process.env.JWT_PRIVATE_KEY_DEV;
const NODE_ENV = process.env.NODE_ENV;

// Security check: Prevent running in production
if (NODE_ENV === 'production') {
  console.error('❌ ERROR: This script cannot be run in production environment!');
  console.error('   JWT generation is only for local development testing.');
  process.exit(1);
}

// Validate that private key is available
if (!JWT_PRIVATE_KEY_DEV) {
  console.error('❌ ERROR: JWT_PRIVATE_KEY_DEV not found in environment variables!');
  console.error('');
  console.error('Please set JWT_PRIVATE_KEY_DEV in your .env file.');
  console.error('You can generate a new key pair with:');
  console.error('');
  console.error('  openssl ecparam -name prime256v1 -genkey -noout -out jwt-dev-private.pem');
  console.error('  openssl ec -in jwt-dev-private.pem -pubout -out jwt-dev-public.pem');
  console.error('');
  console.error('Then copy the contents of jwt-dev-private.pem to JWT_PRIVATE_KEY_DEV in .env');
  console.error('See .env.example for the correct format.');
  process.exit(1);
}

// Generate JWT payload
const payload = {
  test: true,
  message: 'This is a test JWT token for development',
  generated: new Date().toISOString(),
};

// Optional: Add standard claims (not validated by our verification logic)
const options: jwt.SignOptions = {
  algorithm: 'ES256',
  expiresIn: '1h',
  issuer: 'modsecurity-demo-app-dev',
  subject: 'test-token',
};

try {
  // Sign the JWT with the development private key
  const token = jwt.sign(payload, JWT_PRIVATE_KEY_DEV, options);

  console.log('✅ JWT Token Generated Successfully!');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Copy the token below and paste it into the entry form:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(token);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📋 Token Details:');
  console.log(`   Algorithm: ES256 (ECDSA P-256)`);
  console.log(`   Issuer: ${options.issuer}`);
  console.log(`   Subject: ${options.subject}`);
  console.log(`   Expires: ${options.expiresIn}`);
  console.log(`   Generated: ${payload.generated}`);
  console.log('');
  console.log('💡 Usage:');
  console.log('   1. Copy the token above');
  console.log('   2. Navigate to http://localhost:8888/insecure or /secure');
  console.log('   3. Paste the token into the entry form');
  console.log('   4. Submit the form');
  console.log('   5. On /secure, the row should have a red background (JWT verified)');
  console.log('');

  // Decode and display payload for verification
  const decoded = jwt.decode(token, { complete: true });
  if (decoded) {
    console.log('🔍 Decoded Token (for verification):');
    console.log(JSON.stringify(decoded, null, 2));
  }

} catch (error) {
  console.error('❌ ERROR: Failed to generate JWT token!');
  console.error('');
  if (error instanceof Error) {
    console.error(`Error message: ${error.message}`);
  }
  console.error('');
  console.error('Please check that JWT_PRIVATE_KEY_DEV is a valid ES256 private key.');
  console.error('The key should be in PEM format and generated with:');
  console.error('  openssl ecparam -name prime256v1 -genkey -noout');
  process.exit(1);
}

