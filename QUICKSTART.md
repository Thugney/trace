# Quick Start Guide

Get your Family Management PWA running in 5 minutes!

## For Synology Users (Recommended)

### 1. Prerequisites
- Synology NAS with Docker installed
- SSH access enabled
- Grok API key (optional, get from https://x.ai)

### 2. Deploy in 3 Steps

```bash
# Step 1: SSH into your Synology
ssh admin@<your-synology-ip>

# Step 2: Clone and configure
cd /volume1/docker
sudo git clone <your-repo-url> family-pwa
cd family-pwa
sudo cp .env.example .env
sudo nano .env  # Add your GROK_API_KEY

# Step 3: Start the application
sudo docker-compose up -d --build
```

### 3. Access the App
Open browser: `http://<your-synology-ip>:3000`

That's it! 🎉

## For Local Development

### 1. Start Backend
```bash
cd backend
npm install
npm run dev
```

### 2. Start Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```

### 3. Access
Open browser: `http://localhost:3000`

## First Time Setup

### Default Profiles
The app creates these profiles automatically:
- 1 Parent profile
- 3 Kids: Emma (12), Sofia (7), Oliver (5)

### Configure Grok AI (Optional)
1. Log in as Parent
2. Go to Settings → Grok AI Configuration
3. Enter your API key
4. Save

### Set Parent PIN (Recommended)
1. Go to Settings → Parent PIN Protection
2. Set a 4-digit PIN
3. This protects settings and parent features

## Key Features

### For Parents
- **Diet Tracking**: Log meals, track nutrition for the whole family
- **Task Management**: Create and assign tasks to kids
- **AI Assistant**: Get meal suggestions, task ideas, parenting advice
- **Progress Monitoring**: View kids' progress and achievements

### For Kids
- **My Tasks**: See and complete assigned tasks
- **Points & Stars**: Earn rewards for completing tasks
- **Level Up**: Progress through levels
- **AI Chat**: Get help with homework and learning

## Quick Tasks

### Log a Meal
1. Click "Diet" in sidebar
2. Search for Norwegian food
3. Select food and enter portion
4. Done!

### Create a Task
1. Click "Tasks" in sidebar
2. Click "Add Task"
3. Fill in details (title, category, difficulty)
4. Task appears for your child

### Chat with AI
1. Click "AI Assistant" in sidebar
2. Select context (Diet, Tasks, or General)
3. Type your question
4. Get instant AI suggestions

## Troubleshooting

### Can't access the app?
- Check if containers are running: `sudo docker-compose ps`
- Check firewall settings on Synology
- Try `http://localhost:3000` from Synology itself

### AI not working?
- Make sure you've entered a valid Grok API key in Settings
- Check backend logs: `sudo docker-compose logs backend`

### Need to reset?
```bash
sudo docker-compose down
sudo rm -rf data/
sudo docker-compose up -d
```

## Next Steps

📖 Read the full documentation:
- [README.md](README.md) - Complete overview
- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed deployment guide
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development guide

🔒 Security:
- Set up parent PIN
- Configure firewall rules
- Enable HTTPS via reverse proxy

📱 Mobile:
- Add to home screen for PWA experience
- Works offline after first load

## Support

Having issues?
1. Check the logs: `sudo docker-compose logs`
2. Review [DEPLOYMENT.md](DEPLOYMENT.md) troubleshooting section
3. Verify your .env configuration

## Data Location

Your data is stored in: `./data/family.db`

**Backup regularly!**
```bash
sudo cp data/family.db data/family.db.backup
```

---

**Enjoy your Family Management PWA!** 👨‍👩‍👧‍👦
