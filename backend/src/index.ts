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
import notesRoutes from './routes/notes';
import goalsRoutes from './routes/goals';
import notificationsRoutes from './routes/notifications';
import gamificationRoutes from './routes/gamification';
import aiGamificationRoutes from './routes/ai-gamification';
import rewardsRoutes from './routes/rewards';
import remindersRoutes from './routes/reminders';
import familyQuizzesRoutes from './routes/family-quizzes';
import schoolRoutes from './routes/school';
import regularSchoolRoutes from './routes/regular-school';
import booksRoutes from './routes/books';
import shoppingRoutes from './routes/shopping';
import activitiesRoutes from './routes/activities';
import h5pRoutes from './routes/h5p';
import familiesRoutes from './routes/families';
import learnRoutes from './routes/learn';
import { initScheduler } from './services/scheduler';
import { ensureAuthSessionSchema } from './services/authSessions';
import { ensureLearnSchema } from './services/learn/schema';
import { seedLearnCatalog } from './services/learn/catalog';
import { importPackagedLearnContent } from './services/learn/contentImport';
import { migrateLegacyParentPin, migrateLegacyProfileCredentials } from './services/credentials';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Trust proxy - required when behind nginx/reverse proxy (e.g., Synology)
// This allows express-rate-limit to correctly identify users by IP
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Rate limiting - only on login to prevent brute force attacks
// Authenticated endpoints have no rate limit (scalable for many users)
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 30, // 30 failed login attempts per minute per IP (prevents brute force)
  message: { error: 'Too many login attempts, please wait a minute' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins against limit
});

// Only apply rate limit to login endpoint
app.use('/api/profiles/login', loginLimiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
initDatabase();

// Auth sessions + repeat-safe hashing of legacy plaintext PINs/passwords
ensureAuthSessionSchema();
try {
  const migrated = migrateLegacyProfileCredentials();
  const parentPinMigrated = migrateLegacyParentPin();
  if (migrated.pins || migrated.passwords || parentPinMigrated) {
    console.log(`🔐 Hashed legacy credentials: ${migrated.pins} PIN(s), ${migrated.passwords} password(s)${parentPinMigrated ? ', parent PIN' : ''}`);
  }
} catch (error: any) {
  console.error('Credential migration error:', error.message);
}

// FamilyHub Learn: additive schema + idempotent reviewed-content library seed
try {
  ensureLearnSchema();
  seedLearnCatalog();
  // Grades 1-10 research package: validated, draft-only, repeat-safe (LEARN_CONTENT_AUTO_IMPORT=false to skip)
  importPackagedLearnContent();
} catch (error: any) {
  console.error('Learn initialization error:', error.message);
}

// Routes
app.use('/api/profiles', profileRoutes);
app.use('/api/diet', dietRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/ai-gamification', aiGamificationRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/family-quizzes', familyQuizzesRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/regular-school', regularSchoolRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/h5p', h5pRoutes);
app.use('/api/families', familiesRoutes);
app.use('/api/learn', learnRoutes);

// Initialize scheduler after database
initScheduler();

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
