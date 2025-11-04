import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';

// User interface for session storage
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  photo?: string;
}

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8888/auth/google/callback';

// Validate required environment variables
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('❌ ERROR: Missing required environment variables!');
  console.error('   Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file');
  console.error('   See .env.example for setup instructions');
  process.exit(1);
}

// Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    (_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) => {
      // Extract user information from Google profile
      const user: SessionUser = {
        id: profile.id,
        email: profile.emails?.[0]?.value || '',
        displayName: profile.displayName || '',
        photo: profile.photos?.[0]?.value,
      };

      console.log(`✅ User authenticated: ${user.email} (${user.displayName})`);

      // Pass user to Passport
      return done(null, user);
    }
  )
);

// Serialize user to session
// For this demo, we store the entire user object in the session
passport.serializeUser((user: any, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;

