/**
 * Global Error Handling Middleware
 */

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

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
