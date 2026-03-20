# Legacy Synology Bootstrap Guide

Current live Trace deployment does not follow all paths in this older guide.
Use [docs/synology-operations-runbook.md](docs/synology-operations-runbook.md) as the authoritative operations document for the active NAS deployment.

Current live deployment facts:
- SSH host: `192.168.1.135`
- SSH port: `41`
- Repo path: `/volume2/docker/trace`
- Live branch: `feature/school-leaderboard`

Do not use this file for routine live deploys. This document is kept only as a bootstrap/reference guide and still contains older example paths such as `/volume1/docker/family-pwa`.

This guide will help you deploy the Family Management PWA on your Synology NAS using Docker.

## Prerequisites

1. Synology NAS with DSM 7.0 or higher
2. Docker package installed from Package Center
3. SSH access enabled
4. Grok API key (get from https://x.ai)

## Step 1: Prepare Your Synology

### Enable SSH
1. Open Control Panel
2. Go to Terminal & SNMP
3. Enable SSH service (port 22)

### Install Docker
1. Open Package Center
2. Search for "Docker"
3. Click Install

## Step 2: Upload Project Files

### Option A: Using Git (Recommended)
```bash
# SSH into your Synology
ssh admin@<your-synology-ip>

# Create docker directory if it doesn't exist
sudo mkdir -p /volume1/docker
cd /volume1/docker

# Clone the repository
sudo git clone <your-repo-url> family-pwa
cd family-pwa
```

### Option B: Using File Station
1. Open File Station
2. Create folder: `docker/family-pwa`
3. Upload all project files to this folder

## Step 3: Configure Environment Variables

```bash
cd /volume1/docker/family-pwa

# Create .env file from example
sudo cp .env.example .env

# Edit the .env file
sudo nano .env
```

Add your Grok API key:
```
GROK_API_KEY=your_actual_grok_api_key_here
```

Save and exit (Ctrl+X, Y, Enter)

## Step 4: Build and Start Containers

```bash
# Make sure you're in the project directory
cd /volume1/docker/family-pwa

# Build and start the containers
sudo docker-compose up -d --build
```

This will:
- Build the backend and frontend Docker images
- Start both containers
- Create the SQLite database
- Initialize default profiles

## Step 5: Access the Application

1. Open your web browser
2. Navigate to: `http://<your-synology-ip>:3000`
3. You should see the profile selection screen

Default profiles created:
- 1 Parent profile
- 3 Child profiles (ages 5, 7, 12)

## Step 6: Configure Grok AI (Optional but Recommended)

1. Log in as Parent
2. Go to Settings
3. Enter your Grok API key
4. Save settings

## Port Configuration

The application uses these ports:
- **Frontend**: 3000
- **Backend API**: 3001

If these ports are already in use, you can change them:

1. Edit `docker-compose.yml`
2. Change the port mappings:
   ```yaml
   ports:
     - "YOUR_PORT:3000"  # Frontend
   ```
3. Restart containers:
   ```bash
   sudo docker-compose down
   sudo docker-compose up -d
   ```

## Managing the Application

### View Logs
```bash
# All logs
sudo docker-compose logs -f

# Backend only
sudo docker-compose logs -f backend

# Frontend only
sudo docker-compose logs -f frontend
```

### Stop the Application
```bash
sudo docker-compose down
```

### Start the Application
```bash
sudo docker-compose up -d
```

### Restart the Application
```bash
sudo docker-compose restart
```

### Update the Application
```bash
# Pull latest changes (if using git)
sudo git pull

# Rebuild and restart
sudo docker-compose up -d --build
```

## Data Backup

Your data is stored in: `/volume1/docker/family-pwa/data/family.db`

### Backup Database
```bash
# Create backup
sudo cp /volume1/docker/family-pwa/data/family.db \
       /volume1/docker/family-pwa/data/family.db.backup-$(date +%Y%m%d)

# Or use docker-compose
sudo docker-compose exec backend \
  cp /app/data/family.db /app/data/family.db.backup
```

### Restore Database
```bash
# Stop the application
sudo docker-compose down

# Restore backup
sudo cp /volume1/docker/family-pwa/data/family.db.backup \
       /volume1/docker/family-pwa/data/family.db

# Start the application
sudo docker-compose up -d
```

## Troubleshooting

### Container won't start
```bash
# Check container status
sudo docker-compose ps

# Check logs for errors
sudo docker-compose logs
```

### Can't access the application
1. Check if containers are running:
   ```bash
   sudo docker-compose ps
   ```

2. Check Synology firewall settings
3. Try accessing from the Synology itself:
   ```bash
   curl http://localhost:3000
   ```

### Database errors
```bash
# Reset database (WARNING: This will delete all data)
sudo docker-compose down
sudo rm /volume1/docker/family-pwa/data/family.db
sudo docker-compose up -d
```

### API key not working
1. Verify your Grok API key is correct
2. Check backend logs:
   ```bash
   sudo docker-compose logs backend | grep -i grok
   ```

## Security Recommendations

1. **Set a Parent PIN**: Configure a PIN in Settings to protect parent features

2. **Enable HTTPS**: Use Synology's reverse proxy to add HTTPS
   - Control Panel → Application Portal → Reverse Proxy
   - Create new rule for your application

3. **Firewall**: Restrict access to your local network
   - Control Panel → Security → Firewall
   - Create rules to limit access

4. **Regular Backups**: Set up automated backups
   - Use Synology's Task Scheduler
   - Schedule daily database backups

## Accessing from Mobile Devices

1. Connect to the same network as your Synology
2. Open browser on mobile device
3. Navigate to: `http://<synology-ip>:3000`
4. Add to home screen for PWA experience:
   - **iOS**: Safari → Share → Add to Home Screen
   - **Android**: Chrome → Menu → Add to Home Screen

## Performance Optimization

### For better performance on Synology:

1. **Allocate more resources to Docker**:
   - Docker → Settings
   - Increase CPU and memory limits

2. **Use SSD cache** (if available):
   - Storage Manager → SSD Cache
   - Create cache for Docker volume

3. **Enable resource monitoring**:
   - Resource Monitor
   - Track Docker container performance

## Support

For issues or questions:
1. Check the logs: `sudo docker-compose logs`
2. Review the README.md file
3. Check Docker container status: `sudo docker-compose ps`

## Updating

To update to a new version:

```bash
cd /volume1/docker/family-pwa

# Backup first!
sudo cp -r data data.backup

# Pull updates
sudo git pull  # or upload new files

# Rebuild
sudo docker-compose down
sudo docker-compose up -d --build
```

## Uninstalling

To completely remove the application:

```bash
# Stop and remove containers
sudo docker-compose down

# Remove images
sudo docker-compose down --rmi all

# Remove data (optional - backup first!)
sudo rm -rf /volume1/docker/family-pwa
```

---

**Congratulations!** Your Family Management PWA should now be running on your Synology NAS! 🎉
