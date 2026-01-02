#!/bin/bash

echo "🔄 Starting complete rebuild..."
echo ""

echo "1️⃣ Pulling latest code..."
git pull origin claude/fix-project-flow-dcUOs

echo ""
echo "2️⃣ Stopping containers..."
sudo docker-compose down

echo ""
echo "3️⃣ Removing old images (forcing rebuild)..."
sudo docker rmi family-pwa-frontend:latest 2>/dev/null || true
sudo docker rmi family-pwa-backend:latest 2>/dev/null || true
sudo docker image prune -f

echo ""
echo "4️⃣ Building fresh images (no cache)..."
sudo docker-compose build --no-cache --pull

echo ""
echo "5️⃣ Starting containers..."
sudo docker-compose up -d

echo ""
echo "6️⃣ Checking container status..."
sudo docker-compose ps

echo ""
echo "✅ Rebuild complete!"
echo ""
echo "⚠️  IMPORTANT: Clear your browser cache or open in incognito mode"
echo "   - Chrome: Ctrl+Shift+Del → Clear cached images and files"
echo "   - Or open incognito: Ctrl+Shift+N"
echo ""
echo "📝 View logs:"
echo "   Frontend: sudo docker logs family-pwa-frontend"
echo "   Backend:  sudo docker logs family-pwa-backend"
