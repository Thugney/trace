# Development Guide

## Local Development Setup

### Prerequisites
- Node.js 20+ (LTS recommended)
- npm or yarn
- Git

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp ../.env.example ./.env

# Add your Grok API key to .env
# GROK_API_KEY=your_key_here

# Run development server
npm run dev
```

Backend will start on http://localhost:3001

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Run development server
npm run dev
```

Frontend will start on http://localhost:3000

### Database

The SQLite database will be created automatically at `./data/family.db`

To reset the database:
```bash
rm -rf data/family.db
# Restart backend - it will recreate the database
```

## Project Structure

```
/trace
├── backend/
│   ├── src/
│   │   ├── database/
│   │   │   └── init.ts         # Database schema and initialization
│   │   ├── routes/
│   │   │   ├── profiles.ts     # Profile management
│   │   │   ├── diet.ts         # Diet tracking
│   │   │   ├── tasks.ts        # Task management
│   │   │   ├── ai.ts           # AI integration
│   │   │   └── settings.ts     # Settings
│   │   └── index.ts            # Express server
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.tsx      # Main layout
│   │   ├── context/
│   │   │   └── ProfileContext.tsx  # Profile state management
│   │   ├── pages/
│   │   │   ├── ProfileSelector.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── DietTracking.tsx
│   │   │   ├── TasksManager.tsx
│   │   │   ├── AIAssistant.tsx
│   │   │   └── Settings.tsx
│   │   ├── services/
│   │   │   └── api.ts          # API client
│   │   ├── types/
│   │   │   └── index.ts        # TypeScript types
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── data/                       # SQLite database (gitignored)
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── DEPLOYMENT.md
└── DEVELOPMENT.md
```

## API Endpoints

### Profiles
- `GET /api/profiles` - Get all profiles
- `GET /api/profiles/:id` - Get single profile
- `POST /api/profiles` - Create profile
- `PUT /api/profiles/:id` - Update profile
- `DELETE /api/profiles/:id` - Delete profile
- `GET /api/profiles/:id/stats` - Get profile stats

### Diet
- `GET /api/diet/foods/search?query=` - Search foods
- `GET /api/diet/foods/:id` - Get food details
- `POST /api/diet/foods` - Add custom food
- `POST /api/diet/log` - Log meal
- `GET /api/diet/logs/:profileId` - Get meal logs
- `GET /api/diet/nutrition/:profileId` - Get nutrition summary
- `POST /api/diet/goals` - Set diet goals
- `GET /api/diet/meal-plans` - Get meal plans
- `POST /api/diet/meal-plans` - Create meal plan

### Tasks
- `GET /api/tasks/:profileId` - Get tasks for profile
- `GET /api/tasks/task/:id` - Get single task
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `POST /api/tasks/:id/complete` - Complete task
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/progress/:profileId` - Get progress
- `GET /api/tasks/rewards/:profileId` - Get rewards
- `POST /api/tasks/rewards` - Create reward
- `POST /api/tasks/rewards/:id/claim` - Claim reward

### AI
- `POST /api/ai/chat` - Chat with AI
- `POST /api/ai/meal-suggestions` - Get meal suggestions
- `POST /api/ai/task-recommendations` - Get task recommendations
- `GET /api/ai/conversations/:profileId` - Get conversation history
- `DELETE /api/ai/conversations/:profileId` - Clear conversation history

### Settings
- `GET /api/settings` - Get all settings
- `GET /api/settings/:key` - Get single setting
- `POST /api/settings/:key` - Update setting
- `POST /api/settings/verify-pin` - Verify parent PIN
- `POST /api/settings/set-pin` - Set parent PIN

## Database Schema

### profiles
- id, name, type (parent/child), age, gender, avatar, settings, created_at, updated_at

### diet_goals
- id, profile_id, calories_target, protein_target, carbs_target, fat_target, weight_goal

### food_items
- id, name, name_no, brand, calories, protein, carbs, fat, fiber, serving_size, serving_unit, barcode, source, is_norwegian

### meal_logs
- id, profile_id, food_id, meal_type, portion_size, portion_unit, calories_consumed, protein_consumed, carbs_consumed, fat_consumed, logged_at, notes

### meal_plans
- id, profile_id, name, description, day_of_week, meal_type, recipe_data, is_family_plan

### tasks
- id, profile_id, title, description, category, points, difficulty, is_recurring, recurrence_pattern, due_date, completed, completed_at, created_by

### progress
- id, profile_id, task_id, points_earned, stars_earned, level, total_points, total_stars, achievements, logged_at

### rewards
- id, profile_id, title, description, type, points_required, icon, is_claimed, claimed_at

### ai_conversations
- id, profile_id, context, user_message, ai_response, created_at

### settings
- id, key, value, updated_at

## Adding New Features

### Adding a New API Endpoint

1. Create route handler in `backend/src/routes/`
2. Add TypeScript types in `frontend/src/types/index.ts`
3. Add API client method in `frontend/src/services/api.ts`
4. Use in React components

### Adding a New Page

1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Add navigation link in `frontend/src/components/Layout.tsx`

## Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Manual Testing
1. Test with different profiles (parent and kids of different ages)
2. Test offline functionality (disconnect network)
3. Test PWA installation (Add to Home Screen)
4. Test AI features with valid API key

## Building for Production

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
# Serve the dist/ folder
```

### Docker
```bash
docker-compose up -d --build
```

## Troubleshooting

### Port Already in Use
Change ports in `docker-compose.yml` or kill the process:
```bash
# Find process on port 3000
lsof -i :3000
kill -9 <PID>
```

### Database Locked
Stop all backend instances and restart

### CORS Errors
Check backend CORS configuration in `backend/src/index.ts`

### PWA Not Installing
- Must be served over HTTPS (except localhost)
- Check manifest.json configuration
- Check service worker registration

## Code Style

- TypeScript strict mode enabled
- ESLint for linting
- Prettier for formatting (recommended)
- Functional React components with hooks
- Async/await over promises

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "feat: add your feature"

# Push to repository
git push origin feature/your-feature

# Create pull request
```

## Performance Optimization

- Use React.memo for expensive components
- Implement virtual scrolling for long lists
- Optimize images and assets
- Use lazy loading for routes
- Implement proper caching strategies

## Security Considerations

- Never commit API keys
- Use environment variables
- Implement rate limiting (already configured)
- Validate all user inputs
- Sanitize database queries (using parameterized queries)
- Implement parent PIN for sensitive operations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## Resources

- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Express Documentation](https://expressjs.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [Better SQLite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
- [Grok AI Documentation](https://docs.x.ai/)
