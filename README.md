# ModSecurity Web Application Firewall Demo

A demonstration project showcasing OWASP ModSecurity Core Rule Set (CRS) protecting a deliberately vulnerable web application, with Google OAuth authentication for secure endpoints.

## Project Objectives

- **Show how WAFs protect vulnerable applications** - ModSecurity blocks SQL injection attacks *before* they reach the application code
- **Compare protected vs. unprotected endpoints** - Side-by-side demonstration of `/secure` (protected) vs. `/insecure` (vulnerable)
- **Demonstrate OAuth 2.0 authentication flow** - Real-world implementation of Google OAuth
- **Defense in depth** - Multiple security layers working together (Authentication + WAF + Application JWT verification)

### Architecture Overview

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  nginx + ModSecurity (Port 8888)    │
│  ┌─────────────────────────────┐   │
│  │ /secure   → ModSecurity ON  │   │
│  │ /insecure → ModSecurity OFF │   │
│  └─────────────────────────────┘   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Node.js + Express + TypeScript     │
│  ┌─────────────────────────────┐   │
│  │ Google OAuth Authentication │   │
│  │ Session Management (SQLite) │   │
│  │ Intentionally Vulnerable    │   │
│  │ SQL Injection Code          │   │
│  └─────────────────────────────┘   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  SQLite Database                    │
│  - entries.db (user submissions)    │
│  - sessions.db (auth sessions)      │
└─────────────────────────────────────┘
```

## Endpoints

### `/secure` - Protected Endpoint

**Security Features:**
- ✅ **Google OAuth Required** - Users must authenticate before access
- ✅ **ModSecurity Enabled** - SQL injection attempts blocked with 403 Forbidden
- ✅ **Session Management** - Persistent authentication across requests
- ⚠️ **Intentionally Vulnerable Code** - Uses string interpolation for SQL queries (for demonstration)

**User Experience:**
1. Unauthenticated users are redirected to Google OAuth login
2. After authentication, users see a form to submit entries
3. Authenticated user's name/email displayed on page
4. Logout button available
5. All entries stored in shared database

**Security Demonstration:**
- Normal form submissions work correctly
- SQL injection payloads are **blocked by ModSecurity** before reaching the vulnerable code
- Shows how WAFs protect even vulnerable applications

### `/insecure` - Unprotected Endpoint

**Security Features:**
- ❌ **No Authentication** - Anyone can access
- ❌ **ModSecurity Disabled** - No WAF protection
- ⚠️ **Intentionally Vulnerable Code** - Uses string interpolation for SQL queries

**Security Demonstration:**
- Normal form submissions work correctly
- SQL injection payloads **succeed** and can manipulate the database
- Shows the importance of WAF protection

### Authentication Endpoints

- **`/auth/google`** - Initiates Google OAuth flow
- **`/auth/google/callback`** - OAuth callback handler
- **`/logout`** - Destroys session and logs out user

## Google OAuth Flow for `/secure` Endpoint

### Initial Access (Unauthenticated User)

```
1. User visits http://localhost:8888/secure
   ↓
2. Express checks authentication status → Not authenticated
   ↓
3. Redirect to /auth/google
   ↓
4. Passport initiates OAuth flow
   ↓
5. Redirect to Google's OAuth consent screen
   URL: https://accounts.google.com/o/oauth2/v2/auth
   Parameters:
   - client_id: Your Google OAuth Client ID
   - redirect_uri: http://localhost:8888/auth/google/callback
   - scope: profile email openid
   - response_type: code
   ↓
6. User logs in with Google account
   ↓
7. User grants permission (minimal scopes: profile, email)
   ↓
8. Google redirects to: http://localhost:8888/auth/google/callback?code=XXXXX
   ↓
9. Passport's Google Strategy:
   - Exchanges authorization code for access token
   - Fetches user profile from Google API
   - Extracts: id, email, displayName, photo
   ↓
10. Session created:
    - User object stored in session
    - Session data persisted to SQLite (sessions.db)
    - Session cookie (connect.sid) sent to browser
    ↓
11. Redirect to /secure (original destination)
    ↓
12. User sees /secure page with:
    - Welcome message: "Logged in as: user@gmail.com"
    - Form to submit entries
    - Table showing all database entries
    - Logout button
```

### Subsequent Requests (Authenticated User)

```
1. User visits http://localhost:8888/secure
   ↓
2. Browser sends session cookie (connect.sid)
   ↓
3. express-session middleware:
   - Reads session ID from cookie
   - Loads session data from SQLite sessions table
   ↓
4. passport.session() middleware:
   - Deserializes user from session
   - Restores user object to req.user
   ↓
5. ensureAuthenticated() middleware:
   - Checks req.isAuthenticated() → true
   - Allows request to proceed
   ↓
6. Route handler renders /secure page
   - User info displayed from req.user
   - Form and table rendered
```

### Logout Flow

```
1. User clicks "Logout" button on /secure page
   ↓
2. GET /logout
   ↓
3. req.logout() - Passport clears user from session
   ↓
4. req.session.destroy() - Destroys entire session
   ↓
5. Session removed from SQLite sessions table
   ↓
6. Session cookie cleared from browser
   ↓
7. Redirect to /insecure (or home page)
   ↓
8. User is now logged out
   - Visiting /secure again will trigger OAuth flow
```

### OAuth Scopes

**Minimal scopes requested:**
- `profile` - Basic profile information (name, photo)
- `email` - User's email address
- `openid` - Required for OpenID Connect

**What we DON'T request:**
- ❌ Gmail access
- ❌ Google Drive access
- ❌ Calendar access
- ❌ Any other Google services

### Session Management

**Session Storage:**
- Sessions stored in SQLite database (`sessions.db`)
- Session data includes: user ID, email, display name, photo URL
- Session cookie: `connect.sid` (HttpOnly, SameSite=lax)
- Session lifetime: 24 hours
- Sessions persist across server restarts (stored in database)

**Security Features:**
- HttpOnly cookies prevent XSS attacks
- SameSite attribute provides CSRF protection
- Secure flag (when using HTTPS)
- Session data encrypted in database

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Google Cloud Console account (for OAuth credentials)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd websec
   ```

2. **Set up Google OAuth** (see "Google OAuth Setup" section below)

3. **Create `.env` file**
   ```bash
   cp .env.example .env
   # Edit .env and add your Google OAuth credentials
   ```

4. **Start the application**
   ```bash
   docker-compose up --build -d
   ```

5. **Access the application**
   - Insecure endpoint: http://localhost:8888/insecure
   - Secure endpoint: http://localhost:8888/secure (requires Google login)

### Google OAuth Setup

1. **Create a Google Cloud Project**
   - Go to https://console.cloud.google.com/
   - Click "New Project"
   - Name: "ModSecurity Demo" (or any name)

2. **Enable APIs**
   - Go to "APIs & Services" → "Library"
   - Enable "Google+ API" or "People API"

3. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" → "OAuth consent screen"
   - User Type: "External"
   - App name: "ModSecurity Demo"
   - Add your email as user support and developer contact
   - Scopes: Add `userinfo.email`, `userinfo.profile`, `openid`
   - Test users: Add your Gmail address

4. **Create OAuth Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Authorized JavaScript origins: `http://localhost:8888`
   - Authorized redirect URIs: `http://localhost:8888/auth/google/callback`
   - Copy Client ID and Client Secret

5. **Update `.env` file**
   ```bash
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:8888/auth/google/callback
   SESSION_SECRET=your-random-secret-key
   ```

   Generate a session secret:
   ```bash
   openssl rand -base64 32
   ```

## Testing

### Run End-to-End Tests

```bash
bash scripts/e2etest.sh
```

**Test Coverage:**
- ✅ Services running
- ✅ Health check endpoint
- ✅ POST to /insecure (add entry)
- ✅ Entry appears in table
- ✅ /secure responds to normal requests
- ✅ ModSecurity blocks SQL injection on /secure (403)
- ✅ /insecure not blocked by ModSecurity
- ✅ SQL injection works on /insecure (intentionally vulnerable)
- ✅ ModSecurity blocks SQL injection on POST /secure
- ✅ Normal POST to /secure works
- ✅ Entry appears in /secure table
- ✅ Database file exists
- ✅ HTML pages render correctly
- ✅ Forms and tables exist on both endpoints

### Manual Testing

**Test SQL Injection on `/insecure` (should succeed):**
```bash
curl -X POST "http://localhost:8888/insecure" \
  -d "entry=test', '2025-01-01T00:00:00.000Z'), ('🚨 SQL INJECTED 🚨', '1999-01-01T00:00:00.000Z') --"

# Verify injection worked
curl -s "http://localhost:8888/insecure" | grep "INJECTED"
```

**Test SQL Injection on `/secure` (should be blocked):**
```bash
curl -X POST "http://localhost:8888/secure" \
  -d "entry=test', '2025-01-01T00:00:00.000Z'), ('🚨 SQL INJECTED 🚨', '1999-01-01T00:00:00.000Z') --"

# Should return: 403 Forbidden
```

**Test OAuth Flow (requires browser):**
1. Visit http://localhost:8888/secure
2. Should redirect to Google login
3. Login with Google account
4. Grant permissions
5. Should redirect back to /secure with user info displayed

## Project Structure

```
websec/
├── app/
│   ├── src/
│   │   ├── index.ts              # Main Express application
│   │   ├── auth/
│   │   │   ├── passport-config.ts # Passport Google OAuth strategy
│   │   │   └── middleware.ts      # Authentication middleware
│   ├── data/
│   │   ├── entries.db            # User-submitted entries
│   │   └── sessions.db           # Authentication sessions
│   ├── package.json              # Node.js dependencies
│   ├── Dockerfile                # Multi-stage build
│   └── tsconfig.json             # TypeScript configuration
├── nginx-config/
│   └── custom-routes.conf        # Route-specific ModSecurity config
├── scripts/
│   └── e2etest.sh                # End-to-end test suite
├── docker-compose.yml            # Service orchestration
├── .env                          # Environment variables (not committed)
├── .env.example                  # Template for .env
└── README.md                     # This file
```

## Security Considerations

### What This Demonstrates

✅ **Defense in Depth** - Multiple security layers working together
✅ **WAF Protection** - ModSecurity blocks attacks before they reach the application
✅ **Authentication** - OAuth 2.0 industry-standard authentication
✅ **Session Security** - HttpOnly cookies, CSRF protection
✅ **Educational Value** - Shows both protected and unprotected scenarios

### Intentional Vulnerabilities (For Educational Purposes)

⚠️ **SQL Injection** - Both `/secure` and `/insecure` use vulnerable string interpolation
⚠️ **No Input Sanitization** - Demonstrates reliance on WAF for protection
⚠️ **Shared Database** - Both endpoints write to the same `entries` table

### Why This Is Safe for Demonstration

- `/secure` is protected by ModSecurity - SQL injection attempts are blocked
- `/insecure` is intentionally vulnerable to show the difference
- Local development only (not exposed to internet)
- SQLite database can be easily reset by deleting `app/data/entries.db`

### Production Considerations

**DO NOT use this code in production without:**
- ✅ Replacing vulnerable SQL code with parameterized queries
- ✅ Adding input validation and sanitization
- ✅ Implementing proper authorization (roles/permissions)
- ✅ Using HTTPS (TLS/SSL)
- ✅ Adding rate limiting
- ✅ Implementing proper error handling
- ✅ Adding logging and monitoring
- ✅ Using environment-specific secrets management
- ✅ Implementing CSRF tokens
- ✅ Adding security headers (CSP, HSTS, etc.)

## Troubleshooting

### ModSecurity Blocking Legitimate Requests

**Symptom:** Getting 403 Forbidden on normal requests

**Common Causes:**
- Browser cookies containing JSON with `$`-prefixed fields (e.g., PostHog analytics)
- Query parameters that look like SQL injection

**Solutions:**
1. Clear browser cookies for localhost:8888
2. Use Incognito/Private browsing mode
3. Check ModSecurity logs: `docker-compose logs modsecurity`

### OAuth Redirect Not Working

**Symptom:** OAuth callback fails or redirects to wrong URL

**Solutions:**
1. Verify `GOOGLE_CALLBACK_URL` in `.env` matches Google Cloud Console
2. Ensure redirect URI is exactly: `http://localhost:8888/auth/google/callback`
3. Check that port 8888 is accessible
4. Verify Google OAuth app is in "Testing" mode with your email as test user

### Session Not Persisting

**Symptom:** Logged out after page refresh

**Solutions:**
1. Check that `app/data/sessions.db` exists and is writable
2. Verify `SESSION_SECRET` is set in `.env`
3. Check browser cookie settings (must allow cookies)
4. Ensure session cookie is not being blocked by browser extensions

### Database Reset

**To clear all entries and start fresh:**
```bash
docker-compose down
rm app/data/entries.db app/data/sessions.db
docker-compose up
```

## License

This is a demonstration/educational project. Use at your own risk.

## Resources

- [OWASP ModSecurity Core Rule Set](https://coreruleset.org/)
- [ModSecurity Documentation](https://github.com/owasp-modsecurity/ModSecurity)
- [Passport.js Documentation](http://www.passportjs.org/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
