import { getCurrentUserProfile } from '../services/authService.js';

/**
 * Middleware to protect routes and require a valid Supabase Access Token.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided. Access denied.',
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Resolve user and details via Auth Service
    const { user, profile } = await getCurrentUserProfile(token);

    // Attach user information to request context
    req.user = user;
    req.profile = profile;

    next();
  } catch (error) {
    console.error('Authentication Error:', error.message);
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid or expired session.',
    });
  }
};

/**
 * Middleware to restrict route access to specific roles.
 * Must be used after requireAuth.
 * @param {string[]} allowedRoles - Roles allowed to access the route (e.g., ['doctor', 'admin'])
 */
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.profile || !allowedRoles.includes(req.profile.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to roles: [${allowedRoles.join(', ')}].`,
      });
    }
    next();
  };
};
