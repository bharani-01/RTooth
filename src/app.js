import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import { errorHandler } from './middlewares/errorMiddleware.js';
import { NotFoundError } from './utils/errors.js';
import { auditMiddleware } from './middlewares/auditMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors({
  origin: '*', // Allow all origins for flexible mobile and website connection, restrict in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan('dev'));
app.use(express.json());
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

// Serve Static Frontend Files with clean URLs support
app.use(express.static(path.join(__dirname, '../public'), { extensions: ['html'] }));

// Versioned API Routes (v1)
app.use('/api/v1/auth', authRoutes);
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
