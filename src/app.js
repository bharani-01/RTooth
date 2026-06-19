import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import hpp from 'hpp';
import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import { errorHandler } from './middlewares/errorMiddleware.js';
import { NotFoundError } from './utils/errors.js';
import { auditMiddleware } from './middlewares/auditMiddleware.js';
import { initDailyNotificationsScheduler } from './services/notificationService.js';
import { authLimiter, uploadLimiter, generalApiLimiter } from './middlewares/rateLimiters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Start daily background notifications scheduler
initDailyNotificationsScheduler();

const app = express();

// ─── Security Headers (helmet) ───────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "https://cdn.jsdelivr.net", "'unsafe-eval'"],
      styleSrc:   ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "blob:", `https://${process.env.SUPABASE_URL?.replace('https://', '') || ''}`],
      connectSrc: [
        "'self'",
        process.env.SUPABASE_URL || '',
        "wss:",
        "ws:",
        "https://ip-api.com",
        "https://*.sentry.io"
      ],
      frameSrc:      ["'none'"],
      objectSrc:     ["'none'"],
      baseUri:       ["'self'"],
      formAction:    ["'self'"],
      frameAncestors:["'none'"],  // Equivalent to X-Frame-Options: DENY
      workerSrc:     ["'self'", "blob:"],
      childSrc:      ["'self'", "blob:"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
    reportOnly: false
  },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,         // 1 year in seconds
    includeSubDomains: true,
    preload: true
  } : false,
  hidePoweredBy: true,
  noSniff: true,
  ieNoOpen: true,
  xssFilter: true,
  dnsPrefetchControl: { allow: false },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,   // Required for Supabase Storage blob URLs
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  permissionsPolicy: {
    features: {
      camera:         [],   // Deny
      microphone:     [],   // Deny
      geolocation:    [],   // Deny
      payment:        [],   // Deny
    }
  }
}));

// ─── Body Parsing with strict size limits ────────────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(hpp()); // Prevent query string parameter pollution attacks

// Rate limiters are imported from './middlewares/rateLimiters.js'

// Configure restricted CORS origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : (process.env.NODE_ENV === 'production'
      ? (() => { throw new Error('[STARTUP FAIL] ALLOWED_ORIGINS must be set in production. Refusing to start with wildcard CORS.'); })()
      : ['http://localhost:5000', 'http://localhost:3000']);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin '${origin}' is not allowed.`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(auditMiddleware);

// Redirect requests ending in .html to their clean URL path counterparts (permanent redirect)
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    const newPath = req.path.slice(0, -5);
    const query = req.url.slice(req.path.length); // Preserve query string parameters
    return res.redirect(301, newPath + query);
  }
  next();
});

// Serve Static Frontend Files with clean URLs support and caching headers
app.use(express.static(path.join(__dirname, '../public'), {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Apply general limiter to all APIs
app.use('/api/v1', generalApiLimiter);

// Versioned API Routes (v1)
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/patients/me/images', uploadLimiter);
app.use('/api/v1/patients/:id/visits', uploadLimiter);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/doctors', doctorRoutes);

// Catch-all route to serve index.html for undefined frontend routes (if doing SPA routing)
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'), (err) => {
    if (err) {
      res.status(404).send('Web resources not found');
    }
  });
});

// Global 404 Handler for API
app.use('/api/*', (req, res, next) => {
  next(new NotFoundError('API endpoint not found.'));
});

// Global Exception Handler Middleware
app.use(errorHandler);

export default app;
