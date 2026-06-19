/**
 * Global Error Handling Middleware
 */

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Normalize blank or JSON-serialized error messages
  if (message === '{}' || message === '[]' || !message.trim()) {
    message = 'An unexpected database/service response or timeout occurred. Please try again.';
  }

  // In production, replace raw database/service error messages with a generic one
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An internal server error occurred. Please contact the administrator.';
  }

  console.error(`[Global Error Interceptor] ${req.method} ${req.originalUrl} - Status: ${statusCode} - Error: ${message}`);
  
  if (statusCode === 500 && err.stack) {
    console.error(err.stack);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && err.stack && { stack: err.stack })
  });
};
