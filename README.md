# Family Hub

A comprehensive multi-family management platform with an optional Church School module. Built as a Progressive Web App for seamless access across all devices.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Private-gray.svg)

## Overview

Family Hub is designed to help families manage their daily activities, tasks, and educational goals. It features a two-tier access model supporting both full-access families and church school-only families, making it ideal for community organizations.

## Features

### Family Management
- **Multi-family support** with two access tiers:
  - **Family Type A**: Full access to all core features
  - **Family Type B**: Church School access only
- Parent and child profile management
- Family-specific settings and preferences
- Admin panel for system-wide management

### Task Management & Gamification
- Create, assign, and track tasks for family members
- **Photo proof system** for task completion verification
- **Timer support** for timed tasks
- Recurring task scheduling
- Task categories and priorities
- **Points system** with economy controls
- Achievement badges and milestones
- **Leaderboards** (family and school levels)
- Streak tracking and bonuses

### Church School Module
- **Teacher portal** with class management
- Student enrollment and tracking
- Assignment creation and grading
- Attendance tracking
- Parent progress views
- Teacher-parent communication

### AI-Powered Features
- **Book creation** with multiple AI providers:
  - Ollama (local, free)
  - Google Gemini
  - Grok
  - OpenAI
- Custom book generation instructions per child
- AI-generated quizzes
- Automatic provider fallback

### Book Library
- Digital book library with reading progress tracking
- Physical book logging
- Reading history and statistics
- Parent view of children's reading activity

### Calendar & Scheduling
- Family calendar with event management
- Task-specific scheduled reminders
- Morning, evening, and weekly notification schedules

### Push Notifications
- Web push notification support
- Profile-based reminder preferences
- Task reminder notifications
- Sound effects for notifications

### Shopping Lists
- Family shopping list management
- Permission-based list creation for children
- Shopping helper assignment

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | SQLite (better-sqlite3) |
| **PWA** | vite-plugin-pwa |
| **Deployment** | Docker, Docker Compose |
| **AI** | Ollama, Gemini, Grok, OpenAI |

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Docker & Docker Compose (for production)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Thugney/trace.git
   cd trace
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

### Production Deployment (Docker)

1. **Build and start containers**
   ```bash
   docker-compose up -d --build
   ```

2. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

### Docker Commands
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild after changes
docker-compose up -d --build
```

## Project Structure

```
family-hub/
├── backend/
│   ├── src/
│   │   ├── database/        # Database schema & migrations
│   │   ├── middleware/      # Auth, feature access
│   │   ├── routes/          # API endpoints
│   │   └── services/        # Business logic
│   │       ├── notifications.ts    # Push notifications
│   │       ├── scheduler.ts        # Cron jobs
│   │       ├── economyControl.ts   # Points anti-abuse
│   │       └── aiUsageControl.ts   # AI cost tracking
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # React contexts
│   │   ├── hooks/           # Custom hooks
│   │   ├── pages/           # Page components
│   │   ├── services/        # API clients
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utilities (sounds, etc.)
│   │   └── version.ts       # App version
│   ├── Dockerfile
│   └── package.json
│
├── data/                    # Persistent data
│   ├── family.db           # SQLite database
│   ├── uploads/            # User uploads
│   └── book-media/         # AI-generated book images
│
├── docker-compose.yml
├── package.json             # Root package (versioning)
├── CHANGELOG.md            # Version history
└── README.md
```

## Environment Variables

### Backend
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend port | `3001` |
| `DATABASE_PATH` | SQLite database path | `/app/data/family.db` |
| `GROK_API_KEY` | Grok AI API key | - |
| `GEMINI_API_KEY` | Google Gemini API key | - |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OLLAMA_URL` | Ollama server URL | - |
| `OLLAMA_MODEL` | Ollama model name | `llama3.2` |
| `VAPID_PUBLIC_KEY` | Web Push public key | - |
| `VAPID_PRIVATE_KEY` | Web Push private key | - |

### Frontend
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3001` |

## User Roles & Permissions

| Role | Core App | Church School |
|------|----------|---------------|
| **Admin** | Full access | Full access |
| **Family A Parent** | Full access | If child enrolled |
| **Family B Parent** | No access | Full access |
| **Teacher** | No access | Teaching features |
| **Child (Family A)** | Based on settings | If enrolled |
| **Child (Family B)** | No access | Student features |

## API Endpoints

### Authentication
- `POST /api/auth/login` - Family login
- `POST /api/auth/profile` - Select profile with PIN

### Profiles
- `GET /api/profiles` - List family profiles
- `POST /api/profiles` - Create profile
- `PUT /api/profiles/:id` - Update profile

### Tasks
- `GET /api/tasks/:profileId` - Get tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id/complete` - Complete task

### Church School
- `GET /api/school/classes` - List classes
- `POST /api/school/assignments` - Create assignment
- `POST /api/school/attendance` - Mark attendance

### Books
- `GET /api/books` - List books
- `POST /api/books/generate` - Generate AI book
- `GET /api/books/media/:filename` - Get book images

### Notifications
- `POST /api/notifications/subscribe` - Subscribe to push
- `POST /api/notifications/send` - Send notification

## Data Backup

```bash
# Backup database
cp ./data/family.db ./data/family.db.backup

# Full backup
tar -czf family-hub-backup-$(date +%Y%m%d).tar.gz ./data
```

## Versioning

This project uses [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes

See [CHANGELOG.md](./CHANGELOG.md) for version history.

```bash
# Bump version
npm run version:patch  # 1.0.0 → 1.0.1
npm run version:minor  # 1.0.0 → 1.1.0
npm run version:major  # 1.0.0 → 2.0.0
```

## License

Private use - Family Hub

## Support

For issues or questions, please open an issue on GitHub.
