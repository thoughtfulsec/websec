// Vitest setup file - runs before all tests
// Set required environment variables for testing

process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:8888/auth/google/callback';
process.env.SESSION_SECRET = 'test-session-secret';

