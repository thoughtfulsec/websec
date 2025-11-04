import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to ensure user is authenticated
 * Redirects to Google OAuth login if not authenticated
 */
export function ensureAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    // User is authenticated, proceed to route handler
    return next();
  }

  // User is not authenticated, redirect to Google OAuth
  console.log(`🔒 Unauthenticated access attempt to ${req.path} - redirecting to /auth/google`);
  res.redirect('/auth/google');
}

