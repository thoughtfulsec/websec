import express, { Request, Response } from 'express';
import session from 'express-session';
// @ts-ignore - No type definitions available for connect-sqlite3
import connectSqlite3 from 'connect-sqlite3';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import passport from './auth/passport-config';
import { ensureAuthenticated } from './auth/middleware';
import { extractAndVerifyJWT } from './utils/jwt-verification';

const app = express();
const PORT = 8000;

// Session store setup
const SQLiteStore = connectSqlite3(session);

// Environment variables
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
const JWT_PUBLIC_KEY_PROD = process.env.JWT_PUBLIC_KEY_PROD || '';
const JWT_PUBLIC_KEY_DEV = process.env.JWT_PUBLIC_KEY_DEV || '';
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  WARNING: Using default SESSION_SECRET. Set SESSION_SECRET in .env for production!');
}

if (!JWT_PUBLIC_KEY_PROD) {
  console.warn('⚠️  WARNING: JWT_PUBLIC_KEY_PROD not set. JWT verification will not work for production tokens.');
}

if (IS_DEVELOPMENT && !JWT_PUBLIC_KEY_DEV) {
  console.warn('⚠️  WARNING: JWT_PUBLIC_KEY_DEV not set. JWT verification will not work for dev tokens.');
}

// Middleware to parse JSON bodies and URL-encoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database setup
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'entries.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`📁 Created data directory: ${DATA_DIR}`);
}

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log(`🗄️  Database initialized at: ${DB_PATH}`);

  // Create entries table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry TEXT NOT NULL,
      date TEXT NOT NULL,
      isVerifiedJWT INTEGER DEFAULT 0
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating table:', err);
      process.exit(1);
    }
    console.log('✅ Entries table ready');

    // Migration: Add isVerifiedJWT column to existing tables
    db.run(`
      ALTER TABLE entries ADD COLUMN isVerifiedJWT INTEGER DEFAULT 0
    `, (alterErr) => {
      // Ignore error if column already exists
      if (alterErr && !alterErr.message.includes('duplicate column')) {
        console.error('⚠️  Warning: Could not add isVerifiedJWT column:', alterErr.message);
      } else if (!alterErr) {
        console.log('✅ Added isVerifiedJWT column to existing entries table');
      }
    });
  });
});

// Session middleware (MUST be before Passport)
app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: DATA_DIR,
      table: 'sessions',
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: false, // Set to true if using HTTPS
      sameSite: 'lax',
    },
  })
);

// Passport middleware (MUST be after session)
app.use(passport.initialize());
app.use(passport.session());

console.log('✅ Session and Passport middleware initialized');

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ============================================================================
// Authentication Routes
// ============================================================================

// Initiate Google OAuth flow
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'  // Force account selection after logout
  })
);

// Google OAuth callback
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login-failed' }),
  (req: Request, res: Response) => {
    // Successful authentication, redirect to /secure
    console.log(`✅ OAuth callback successful for user: ${(req.user as any)?.email}`);
    res.redirect('/secure');
  }
);

// Logout route
app.get('/logout', (req: Request, res: Response): void => {
  const userEmail = (req.user as any)?.email || 'unknown';
  req.logout((err): void => {
    if (err) {
      console.error('Error during logout:', err);
      res.status(500).send('Error logging out');
      return;
    }
    req.session.destroy((err): void => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      console.log(`👋 User logged out: ${userEmail}`);
      // Clear the session cookie from the browser
      res.clearCookie('connect.sid');
      res.redirect('/insecure');
    });
  });
});

// Login failed page (optional)
app.get('/login-failed', (_req: Request, res: Response) => {
  res.status(401).send(`
    <!DOCTYPE html>
    <html>
    <head><title>Login Failed</title></head>
    <body>
      <h1>Authentication Failed</h1>
      <p>Unable to authenticate with Google. Please try again.</p>
      <a href="/auth/google">Try Again</a>
    </body>
    </html>
  `);
});

// ============================================================================
// Application Routes
// ============================================================================

// Insecure route - GET: Display form and entries table
// This route will NOT be protected by ModSecurity
// INTENTIONALLY VULNERABLE: No input sanitization or SQL injection protection
app.get('/insecure', (_req: Request, res: Response) => {
  // Fetch all entries from database - VULNERABLE to SQL injection
  db.all('SELECT * FROM entries ORDER BY id DESC', [], (err, entries) => {
    if (err) {
      console.error('Error fetching entries:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    // Generate HTML with form and table
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Insecure Endpoint - No Protection</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .warning {
      background-color: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .warning h2 {
      margin-top: 0;
      color: #856404;
    }
    .form-container {
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    .form-container h3 {
      margin-top: 0;
    }
    textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      font-family: Arial, sans-serif;
      resize: vertical;
      box-sizing: border-box;
    }
    button {
      background-color: #007bff;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      margin-top: 10px;
    }
    button:hover {
      background-color: #0056b3;
    }
    .table-container {
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background-color: #343a40;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: bold;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #ddd;
      word-wrap: break-word;
    }
    tr:nth-child(even) {
      background-color: #f8f9fa;
    }
    tr:nth-child(odd) {
      background-color: #ffffff;
    }
    .empty-message {
      text-align: center;
      padding: 20px;
      color: #6c757d;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="warning">
    <h2>⚠️ WARNING: Insecure Endpoint</h2>
    <p><strong>ModSecurity Protection: DISABLED</strong></p>
    <p>This endpoint is intentionally vulnerable to demonstrate security risks. No input sanitization or SQL injection protection is applied.</p>
  </div>

  <div class="form-container">
    <h3>Submit an Entry</h3>
    <form method="POST" action="/insecure">
      <textarea name="entry" rows="4" placeholder="Enter your text here..." maxlength="5000" required></textarea>
      <br>
      <button type="submit">Submit</button>
    </form>
  </div>

  <div class="table-container">
    <h3>Database Entries</h3>
    <table>
      <thead>
        <tr>
          <th>Entry</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${entries.length === 0
          ? '<tr><td colspan="2" class="empty-message">No entries yet. Submit the form above to add one.</td></tr>'
          : entries.map((entry: any) => `
            <tr>
              <td>${entry.entry}</td>
              <td>${entry.date}</td>
            </tr>
          `).join('')
        }
      </tbody>
    </table>
  </div>
</body>
</html>
    `;

    res.status(200).send(html);
  });
});

// Insecure route - POST: Handle form submission
// INTENTIONALLY VULNERABLE: No input sanitization or SQL injection protection
app.post('/insecure', (req: Request, res: Response): void => {
  const { entry } = req.body;

  if (!entry) {
    res.status(400).send('Entry text is required');
    return;
  }

  // Validate length (max 5000 characters)
  if (entry.length > 5000) {
    res.status(400).send('Entry text is too long (max 5000 characters)');
    return;
  }

  const date = new Date().toISOString();

  // JWT Verification: Check if entry contains a valid JWT token
  const jwtVerification = extractAndVerifyJWT(
    entry,
    JWT_PUBLIC_KEY_PROD,
    JWT_PUBLIC_KEY_DEV,
    IS_DEVELOPMENT
  );

  const isVerifiedJWT = jwtVerification.isValid ? 1 : 0;

  if (jwtVerification.isValid) {
    console.log(`🔐 JWT signature verified successfully for token: ${jwtVerification.token?.substring(0, 20)}...`);
  } else if (jwtVerification.token) {
    console.log(`⚠️  JWT signature verification failed: ${jwtVerification.error}`);
  }

  // INTENTIONALLY VULNERABLE: Direct string interpolation - susceptible to SQL injection
  // This is BY DESIGN for demonstration purposes
  const vulnerableQuery = `INSERT INTO entries (entry, date, isVerifiedJWT) VALUES ('${entry}', '${date}', ${isVerifiedJWT})`;

  db.run(vulnerableQuery, [], (err: Error) => {
    if (err) {
      console.error('Error inserting entry:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    console.log(`📝 New entry added: "${entry.substring(0, 50)}${entry.length > 50 ? '...' : ''}" (JWT verified: ${isVerifiedJWT === 1})`);

    // Redirect back to GET /insecure to display updated table
    res.redirect('/insecure');
  });
});

// Secure route - GET: Display form and entries table
// This route WILL be protected by ModSecurity AND requires Google OAuth authentication
// INTENTIONALLY VULNERABLE: No input sanitization or SQL injection protection
// ModSecurity CRS should block SQL injection attempts before they reach the application
app.get('/secure', ensureAuthenticated, (req: Request, res: Response) => {
  // Get authenticated user info
  const user = req.user as any;
  const userEmail = user?.email || 'Unknown';
  const userName = user?.displayName || 'User';

  // Fetch all entries from database - VULNERABLE to SQL injection
  db.all('SELECT * FROM entries ORDER BY id DESC', [], (err: Error, entries: any[]) => {
    if (err) {
      console.error('Error fetching entries:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    // Generate HTML with form and table
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Secure Endpoint - ModSecurity Protected</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .warning {
      background-color: #d4edda;
      border: 2px solid #28a745;
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .warning h2 {
      margin-top: 0;
      color: #155724;
    }
    .form-container {
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    .form-container h3 {
      margin-top: 0;
    }
    textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      font-family: Arial, sans-serif;
      resize: vertical;
      box-sizing: border-box;
    }
    button {
      background-color: #28a745;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      margin-top: 10px;
    }
    button:hover {
      background-color: #218838;
    }
    .table-container {
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background-color: #343a40;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: bold;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #ddd;
      word-wrap: break-word;
    }
    tr:nth-child(even) {
      background-color: #f8f9fa;
    }
    tr:nth-child(odd) {
      background-color: #ffffff;
    }
    tr.jwt-verified {
      background-color: #f8d7da !important;
      border-left: 4px solid #dc3545;
    }
    .empty-message {
      text-align: center;
      padding: 20px;
      color: #6c757d;
      font-style: italic;
    }
    .user-info {
      background-color: #e7f3ff;
      border: 2px solid #0066cc;
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .user-details {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .user-text h3 {
      margin: 0 0 5px 0;
      color: #003d7a;
    }
    .user-text p {
      margin: 0;
      color: #555;
      font-size: 14px;
    }
    .logout-btn {
      background-color: #dc3545;
      color: white;
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      text-decoration: none;
      display: inline-block;
    }
    .logout-btn:hover {
      background-color: #c82333;
    }
  </style>
</head>
<body>
  <div class="user-info">
    <div class="user-details">
      <div class="user-text">
        <h3>👤 ${userName}</h3>
        <p>Logged in as: ${userEmail}</p>
      </div>
    </div>
    <a href="/logout" class="logout-btn">Logout</a>
  </div>

  <div class="warning">
    <h2>✅ SECURE: Protected Endpoint</h2>
    <p><strong>ModSecurity Protection: ENABLED</strong></p>
    <p><strong>Google OAuth: AUTHENTICATED</strong></p>
    <p>This endpoint is protected by OWASP ModSecurity CRS. SQL injection attempts will be blocked with 403 Forbidden.</p>
  </div>

  <div class="form-container">
    <h3>Submit an Entry</h3>
    <form method="POST" action="/secure">
      <textarea name="entry" rows="4" placeholder="Enter your text here..." maxlength="5000" required></textarea>
      <br>
      <button type="submit">Submit</button>
    </form>
  </div>

  <div class="table-container">
    <h3>Database Entries</h3>
    <table>
      <thead>
        <tr>
          <th>Entry</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${entries.length === 0
          ? '<tr><td colspan="2" class="empty-message">No entries yet. Submit the form above to add one.</td></tr>'
          : entries.map((entry: any) => `
            <tr${entry.isVerifiedJWT ? ' class="jwt-verified"' : ''}>
              <td>${entry.entry}</td>
              <td>${entry.date}</td>
            </tr>
          `).join('')
        }
      </tbody>
    </table>
  </div>
</body>
</html>
    `;

    res.status(200).send(html);
  });
});

// Secure route - POST: Handle form submission
// INTENTIONALLY VULNERABLE: No input sanitization or SQL injection protection
// ModSecurity CRS should block SQL injection attempts before they reach the application
app.post('/secure', ensureAuthenticated, (req: Request, res: Response): void => {
  const { entry } = req.body;

  if (!entry) {
    res.status(400).send('Entry text is required');
    return;
  }

  // Validate length (max 5000 characters)
  if (entry.length > 5000) {
    res.status(400).send('Entry text is too long (max 5000 characters)');
    return;
  }

  const date = new Date().toISOString();

  // JWT Verification: Check if entry contains a valid JWT token
  const jwtVerification = extractAndVerifyJWT(
    entry,
    JWT_PUBLIC_KEY_PROD,
    JWT_PUBLIC_KEY_DEV,
    IS_DEVELOPMENT
  );

  const isVerifiedJWT = jwtVerification.isValid ? 1 : 0;

  if (jwtVerification.isValid) {
    console.log(`🔐 JWT signature verified successfully for token: ${jwtVerification.token?.substring(0, 20)}...`);
  } else if (jwtVerification.token) {
    console.log(`⚠️  JWT signature verification failed: ${jwtVerification.error}`);
  }

  // INTENTIONALLY VULNERABLE: Direct string interpolation - susceptible to SQL injection
  // This is BY DESIGN for demonstration purposes
  const vulnerableQuery = `INSERT INTO entries (entry, date, isVerifiedJWT) VALUES ('${entry}', '${date}', ${isVerifiedJWT})`;

  db.run(vulnerableQuery, [], (err: Error) => {
    if (err) {
      console.error('Error inserting entry:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    console.log(`📝 New entry added: "${entry.substring(0, 50)}${entry.length > 50 ? '...' : ''}" (JWT verified: ${isVerifiedJWT === 1})`);

    // Redirect back to GET /secure to display updated table
    res.redirect('/secure');
  });
});

// 404 Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.status(404).json({});
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   - GET  /health              - Health check`);
  console.log(`   - GET  /auth/google         - Initiate Google OAuth login`);
  console.log(`   - GET  /auth/google/callback - OAuth callback (automatic)`);
  console.log(`   - GET  /logout              - Logout and destroy session`);
  console.log(`   - GET  /insecure            - Unprotected route (ModSecurity OFF, No Auth)`);
  console.log(`   - POST /insecure            - Submit entry (ModSecurity OFF, No Auth)`);
  console.log(`   - GET  /secure              - Protected route (ModSecurity ON, OAuth Required)`);
  console.log(`   - POST /secure              - Submit entry (ModSecurity ON, OAuth Required)`);
});

