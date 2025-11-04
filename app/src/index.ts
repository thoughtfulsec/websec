import express, { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const app = express();
const PORT = 8000;

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
      date TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating table:', err);
      process.exit(1);
    }
    console.log('✅ Entries table ready');
  });
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

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

  // INTENTIONALLY VULNERABLE: Direct string interpolation - susceptible to SQL injection
  // This is BY DESIGN for demonstration purposes
  const vulnerableQuery = `INSERT INTO entries (entry, date) VALUES ('${entry}', '${date}')`;

  db.run(vulnerableQuery, [], (err) => {
    if (err) {
      console.error('Error inserting entry:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    console.log(`📝 New entry added: "${entry.substring(0, 50)}${entry.length > 50 ? '...' : ''}"`);

    // Redirect back to GET /insecure to display updated table
    res.redirect('/insecure');
  });
});

// Secure route - echoes back query parameters
// This route WILL be protected by ModSecurity
app.get('/secure', (req: Request, res: Response) => {
  const queryParams = req.query;
  
  res.status(200).json({
    message: 'This is a SECURE endpoint - ModSecurity is enabled',
    route: '/secure',
    protection: 'OWASP ModSecurity CRS',
    queryParameters: queryParams,
    info: '✅ This endpoint is protected by ModSecurity',
    timestamp: new Date().toISOString()
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
  console.log(`   - GET /health    - Health check`);
  console.log(`   - GET /insecure  - Unprotected route (ModSecurity OFF)`);
  console.log(`   - GET /secure    - Protected route (ModSecurity ON)`);
});

