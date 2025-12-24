# Family Management PWA

A comprehensive Progressive Web App for family management, featuring diet tracking (Norway-focused), kids' task management, and AI assistance via Grok.

## Features

### 🍽️ Diet Tracking
- Norwegian food database integration
- Calorie and macro tracking
- Meal planning and recipe suggestions
- Individual profiles for each family member
- Nutrition insights and recommendations

### 👨‍👩‍👧‍👦 Kids Task Management
- Individual profiles for each child (ages 5, 7, 12)
- Task tracking (chores, homework, activities, habits)
- Progress visualization (points, stars, levels, charts)
- Reward system (virtual and real-world)
- Age-appropriate interfaces

### 🤖 AI Assistant (Grok Integration)
- Meal suggestions and nutrition advice
- Food logging assistance
- Task recommendations for kids
- Educational content and progress insights
- Parent-controlled settings

### 🔒 Access Control
- **Parent Mode**: Full access to all features, settings, and AI configuration
- **Kid Mode**: Limited access (only tasks, progress, charts, and profile)

## Technology Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Vite PWA
- **Backend**: Node.js + Express
- **Database**: SQLite
- **Deployment**: Docker + Docker Compose (Synology compatible)
- **AI**: Grok API

## Deployment on Synology NAS

### Prerequisites
- Synology NAS with Docker package installed
- SSH access to your Synology
- Grok API key

### Installation Steps

1. **Clone or upload this repository to your Synology**
   ```bash
   cd /volume1/docker/
   git clone <repository-url> family-pwa
   cd family-pwa
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   nano .env
   # Add your Grok API key
   ```

3. **Build and start containers**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Open browser: `http://<synology-ip>:3000`
   - Backend API: `http://<synology-ip>:3001`

### Docker Compose Management

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild after changes
docker-compose up -d --build

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

### Data Persistence

All data is stored in the `./data` directory and persists across container restarts:
- Database: `./data/family.db`
- Uploads: `./data/uploads/`

### Backup

To backup your data:
```bash
# Backup database
cp ./data/family.db ./data/family.db.backup

# Or backup entire data directory
tar -czf family-pwa-backup-$(date +%Y%m%d).tar.gz ./data
```

## Development

### Local Development Setup

1. **Backend**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Environment Variables

- `GROK_API_KEY`: Your Grok AI API key
- `DATABASE_PATH`: Path to SQLite database (default: `/app/data/family.db`)
- `PORT`: Backend port (default: 3001)
- `VITE_API_URL`: Frontend API URL (default: `http://localhost:3001`)

## Project Structure

```
/trace
├── backend/              # Node.js Express API
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── models/      # Database models
│   │   ├── controllers/ # Business logic
│   │   └── services/    # External services (AI, food APIs)
│   ├── Dockerfile
│   └── package.json
├── frontend/             # React PWA
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom hooks
│   │   ├── services/    # API clients
│   │   └── types/       # TypeScript types
│   ├── Dockerfile
│   └── package.json
├── data/                 # Persistent data (SQLite DB)
├── docker-compose.yml
└── README.md
```

## API Documentation

### Authentication
- Profile-based access (no complex auth)
- Parent PIN for accessing settings

### Key Endpoints

**Profiles**
- `GET /api/profiles` - List all profiles
- `POST /api/profiles` - Create profile
- `PUT /api/profiles/:id` - Update profile

**Diet**
- `GET /api/diet/foods` - Search foods
- `POST /api/diet/log` - Log meal
- `GET /api/diet/meals/:profileId` - Get meal history
- `GET /api/diet/nutrition/:profileId` - Get nutrition summary

**Tasks**
- `GET /api/tasks/:profileId` - Get tasks for child
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task (complete, points)
- `GET /api/progress/:profileId` - Get progress stats

**AI**
- `POST /api/ai/chat` - Chat with Grok AI
- `POST /api/ai/meal-suggestions` - Get meal suggestions
- `POST /api/ai/task-recommendations` - Get task ideas

## License

Private use - Family Management PWA

## Support

For issues or questions, refer to the project documentation.
