import express, { Request, Response } from 'express';

const app = express();
const PORT = 8000;

// Middleware to parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Insecure route - echoes back query parameters without sanitization
// This route will NOT be protected by ModSecurity
app.get('/insecure', (req: Request, res: Response) => {
  const queryParams = req.query;
  
  res.status(200).json({
    message: 'This is an INSECURE endpoint - ModSecurity is disabled',
    route: '/insecure',
    protection: 'NONE',
    queryParameters: queryParams,
    warning: '⚠️  This endpoint is vulnerable to attacks!',
    timestamp: new Date().toISOString()
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

// Root endpoint with information
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    application: 'ModSecurity Demo Application',
    version: '1.0.0',
    endpoints: {
      '/': 'This information page',
      '/health': 'Health check endpoint',
      '/insecure': 'Unprotected endpoint (ModSecurity disabled)',
      '/secure': 'Protected endpoint (ModSecurity enabled)'
    },
    instructions: {
      testInsecure: 'curl "http://localhost:8888/insecure?id=1\' OR \'1\'=\'1"',
      testSecure: 'curl "http://localhost:8888/secure?id=1\' OR \'1\'=\'1"',
      testNormal: 'curl "http://localhost:8888/secure?id=123"'
    },
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   - GET /          - Information page`);
  console.log(`   - GET /health    - Health check`);
  console.log(`   - GET /insecure  - Unprotected route (ModSecurity OFF)`);
  console.log(`   - GET /secure    - Protected route (ModSecurity ON)`);
});

