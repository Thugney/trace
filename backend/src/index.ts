import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { initDatabase } from './database/init';
import profileRoutes from './routes/profiles';
import dietRoutes from './routes/diet';
import taskRoutes from './routes/tasks';
import aiRoutes from './routes/ai';
import settingsRoutes from './routes/settings';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
initDatabase();

// Routes
app.use('/api/profiles', profileRoutes);
app.use('/api/diet', dietRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Database: ${process.env.DATABASE_PATH || './data/family.db'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
