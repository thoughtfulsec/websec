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

### OAuth Scopes

**Minimal scopes requested:**
- `profile` - Basic profile information (name, photo)
- `email` - User's email address
- `openid` - Required for OpenID Connect

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

### Manual Testing

**Test SQL Injection on `/insecure` (should succeed):**
```bash
curl -X POST "http://localhost:8888/insecure" \
  -d "entry=test', '2025-01-01T00:00:00.000Z', 0), ('🚨 SQL INJECTED 🚨', '1999-01-01T00:00:00.000Z', 0) --"

# Verify injection worked
curl -s "http://localhost:8888/insecure" | grep "INJECTED"
```

**Test SQL Injection on `/secure` (should be blocked):**
```bash
curl -X POST "http://localhost:8888/secure" \
  -d "entry=test', '2025-01-01T00:00:00.000Z', 0), ('🚨 SQL INJECTED 🚨', '1999-01-01T00:00:00.000Z', 0) --"

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
│   │   ├── index.ts                    # Main Express application
│   │   ├── auth/
│   │   │   ├── passport-config.ts      # Passport Google OAuth strategy
│   │   │   └── middleware.ts           # Authentication middleware
│   │   └── utils/
│   │       ├── jwt-verification.ts     # JWT signature verification (ES256)
│   │       └── profile-transform.ts    # OAuth profile transformation
│   ├── test/
│   │   ├── auth/
│   │   │   └── middleware.test.ts      # Auth middleware unit tests
│   │   └── utils/
│   │       ├── jwt-verification.test.ts # JWT verification unit tests
│   │       └── profile-transform.test.ts # Profile transform unit tests
│   ├── data/
│   │   ├── entries.db                  # User-submitted entries (SQLite)
│   │   └── sessions.db                 # Authentication sessions (SQLite)
│   ├── package.json                    # Node.js dependencies
│   ├── Dockerfile                      # Multi-stage build (dev + production)
│   ├── tsconfig.json                   # TypeScript configuration
│   ├── vitest.config.ts                # Vitest test configuration
│   └── dist/                           # Compiled JavaScript (generated)
├── nginx-config/
│   └── custom-routes.conf              # Route-specific ModSecurity config
├── scripts/
│   ├── e2etest.sh                      # End-to-end test suite (local + production)
│   └── generate-jwt.sh                 # Generate signed JWT for testing
├── terraform/
│   ├── main.tf                         # GCP infrastructure (Compute Engine VM)
│   ├── variables.tf                    # Terraform input variables
│   ├── outputs.tf                      # Terraform outputs (public IP, SSH command)
│   ├── startup-script.sh               # VM initialization script
│   ├── load-env.sh                     # Helper to load .env as TF_VAR_* variables
│   ├── README.md                       # Terraform documentation
│   ├── QUICKSTART.md                   # Quick deployment guide
│   └── CONFIGURATION.md                # Configuration options guide
├── docker-compose.yml                  # Service orchestration (app + modsecurity)
├── .env                                # Environment variables (not committed)
├── .env.example                        # Template for .env
└── README.md                           # This file
```

## Security Considerations

### What This Demonstrates

✅ **Defense in Depth** - Multiple security layers working together
✅ **WAF Protection** - ModSecurity blocks attacks before they reach the application
✅ **Authentication** - OAuth 2.0 industry-standard authentication
✅ **Session Security** - HttpOnly cookies, some CSRF protection via SameSite
✅ **Educational Value** - Shows both protected and unprotected scenarios

### Intentional Vulnerabilities (For Educational Purposes)

⚠️ **SQL Injection** - Both `/secure` and `/insecure` use vulnerable string interpolation
⚠️ **No Input Sanitization** - Demonstrates reliance on WAF for protection
⚠️ **Shared Database** - Both endpoints write to the same `entries` table

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
