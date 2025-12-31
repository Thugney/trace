# Docker Access Troubleshooting Guide

## Quick Fix - Can't Access the Application

If you can't access the application after running `docker-compose up -d`, follow these steps:

### 1. Verify Containers Are Running

```bash
docker-compose ps
```

**Expected output:**
```
NAME                    STATUS              PORTS
family-pwa-backend      Up X minutes        0.0.0.0:3001->3001/tcp
family-pwa-frontend     Up X minutes        0.0.0.0:3000->80/tcp
```

If status shows "Exit" or "Restarting", check the logs (step 2).

### 2. Check Container Logs

```bash
# Check backend logs
docker-compose logs backend

# Check frontend logs
docker-compose logs frontend

# Follow logs in real-time
docker-compose logs -f
```

**Backend should show:**
```
🚀 Backend server running on http://0.0.0.0:3001
📊 Database: /app/data/family.db
🌍 Environment: production
```

**Frontend should show nginx startup messages.**

### 3. Test Port Accessibility

From your host machine:

```bash
# Test if backend port is accessible
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"..."}

# Test if frontend port is accessible
curl http://localhost:3000
# Expected: HTML content
```

If these fail, check:
- Firewall settings
- Port conflicts (something else using ports 3000 or 3001)
- Docker port mapping

### 4. Access from Browser

Try accessing:
1. **Frontend**: `http://localhost:3000` or `http://<your-ip>:3000`
2. **Backend**: `http://localhost:3001/health` (should show JSON)

**Replace `<your-ip>` with:**
- Your computer's local IP (e.g., 192.168.1.100)
- Your Synology NAS IP (if deployed there)

### 5. Network Issues

If accessible via localhost but not via IP:

**On Linux/Mac:**
```bash
# Check if ports are listening on all interfaces (0.0.0.0)
netstat -tuln | grep -E ':(3000|3001)'
```

**On Windows:**
```powershell
netstat -an | findstr "3000 3001"
```

**Expected:** Should show `0.0.0.0:3000` and `0.0.0.0:3001`, not `127.0.0.1:3000`

**Firewall Fix:**
```bash
# Ubuntu/Debian
sudo ufw allow 3000
sudo ufw allow 3001

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

## Common Issues and Solutions

### Issue 1: "This site can't be reached" / ERR_CONNECTION_REFUSED

**Cause:** Frontend trying to reach backend on wrong URL.

**Solution:** This has been fixed in the latest version. The frontend now uses nginx proxy with relative `/api` paths.

**Verify fix:**
```bash
# Check nginx.conf has the proxy configuration
docker exec family-pwa-frontend cat /etc/nginx/conf.d/default.conf | grep -A 5 "location /api"
```

**Should show:**
```nginx
location /api/ {
    proxy_pass http://backend:3001;
    ...
}
```

### Issue 2: Backend Logs Show Port Binding Error

**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:** Port 3001 is already in use by another application.

**Find what's using the port:**
```bash
# Linux/Mac
lsof -i :3001
# or
netstat -tuln | grep 3001

# Windows
netstat -ano | findstr :3001
```

**Fix:**
1. Stop the conflicting service, OR
2. Change the port in `docker-compose.yml`:
```yaml
backend:
  ports:
    - "3002:3001"  # Change 3001 to 3002 (or any available port)
```

### Issue 3: Database Initialization Errors

**Error in logs:** `SQLITE_CANTOPEN` or database errors

**Solution:**
```bash
# Stop containers
docker-compose down

# Create data directory with correct permissions
mkdir -p data
chmod 755 data

# Restart
docker-compose up -d
```

### Issue 4: Frontend Shows White Screen

**Possible causes:**
1. API connection failing
2. Build errors

**Check browser console:**
- Open browser DevTools (F12)
- Look for errors in Console tab
- Check Network tab for failed API requests

**Solutions:**

**If you see CORS errors:**
```bash
# Rebuild with --no-cache
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**If you see 404 on /api requests:**
```bash
# Verify nginx proxy is configured
docker exec family-pwa-frontend cat /etc/nginx/conf.d/default.conf
```

### Issue 5: "Permission Denied" Errors

**Linux users may need to adjust data directory permissions:**

```bash
# Option 1: Run with sudo
sudo docker-compose up -d

# Option 2: Fix permissions
sudo chown -R $USER:$USER data/
chmod -R 755 data/

# Then run without sudo
docker-compose up -d
```

### Issue 6: Changes Not Reflected After Rebuild

**Solution: Full rebuild**

```bash
# Stop and remove containers
docker-compose down

# Remove images
docker-compose rm -f
docker rmi family-pwa-backend family-pwa-frontend

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up -d
```

## Configuration Checklist

Before running `docker-compose up -d`:

- [ ] `.env` file exists (copy from `.env.example`)
- [ ] `GROK_API_KEY` is set in `.env` (optional but recommended)
- [ ] Ports 3000 and 3001 are available
- [ ] Docker and Docker Compose are installed
- [ ] You have permissions to run Docker (or using sudo)

## Environment Variables

### Backend (.env file)
```bash
GROK_API_KEY=your_grok_api_key_here
# PORT is set automatically in docker-compose.yml
# DATABASE_PATH is set automatically in docker-compose.yml
```

### Frontend (set in docker-compose.yml)
```yaml
environment:
  - VITE_API_URL=   # Empty = use nginx proxy (recommended for Docker)
```

**For local development** (outside Docker):
```bash
# In frontend/.env
VITE_API_URL=http://localhost:3001
```

## Debugging Commands

### View Container Status
```bash
docker-compose ps
docker-compose logs backend
docker-compose logs frontend
docker stats  # Show resource usage
```

### Enter Container Shell
```bash
# Backend
docker exec -it family-pwa-backend sh

# Frontend
docker exec -it family-pwa-frontend sh

# Inside container, check:
# - Environment variables: env
# - Network connectivity: ping backend
# - Port listening: netstat -tuln
```

### Test API Endpoints
```bash
# Health check
curl http://localhost:3001/health

# Get profiles
curl http://localhost:3001/api/profiles

# Test through frontend proxy
curl http://localhost:3000/api/profiles
```

### Network Inspection
```bash
# List Docker networks
docker network ls

# Inspect the family network
docker network inspect trace_family-network

# Should show both containers connected
```

## Reset Everything

If all else fails, complete reset:

```bash
# Stop and remove everything
docker-compose down -v

# Remove images
docker rmi family-pwa-backend family-pwa-frontend

# Remove data (WARNING: deletes all data!)
rm -rf data/

# Rebuild from scratch
docker-compose up -d --build

# Check logs
docker-compose logs -f
```

## Production Deployment Notes

### Synology NAS Specific

1. **Firewall**: Open ports 3000 and 3001 in Synology firewall
2. **Permissions**: Use `sudo` for all docker commands
3. **Volume Path**: Data is in `/volume1/docker/family-pwa/data/`

### Reverse Proxy Setup (Optional)

For HTTPS and custom domain:

**Nginx reverse proxy:**
```nginx
server {
    listen 443 ssl;
    server_name family.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Synology built-in reverse proxy:**
1. Control Panel → Login Portal → Advanced → Reverse Proxy
2. Source: `https://family.yourdomain.com:443`
3. Destination: `http://localhost:3000`

## Performance Tuning

### For Low-Memory Devices (like Raspberry Pi)

Edit `docker-compose.yml`:
```yaml
services:
  backend:
    ...
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

## Getting Help

If you're still experiencing issues:

1. **Collect information:**
   ```bash
   docker-compose ps > debug.txt
   docker-compose logs >> debug.txt
   docker network inspect trace_family-network >> debug.txt
   ```

2. **Check the GitHub issues** for similar problems

3. **Verify you're running the latest version:**
   ```bash
   git pull origin main
   docker-compose down
   docker-compose up -d --build
   ```

## Success Indicators

Everything is working when:

✅ `docker-compose ps` shows both containers "Up"
✅ `curl http://localhost:3001/health` returns JSON
✅ `curl http://localhost:3000` returns HTML
✅ Browser can access `http://<your-ip>:3000`
✅ Frontend loads without errors (check browser console)
✅ API calls work (check browser Network tab)

---

**Need more help?** Review [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.
