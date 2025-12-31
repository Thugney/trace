#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================="
echo "Family PWA - Setup Verification"
echo "=================================="
echo ""

# Check if Docker is installed
echo -n "Checking Docker installation... "
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Installed${NC}"
    docker --version
else
    echo -e "${RED}✗ Not found${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

echo ""

# Check if Docker Compose is installed
echo -n "Checking Docker Compose installation... "
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓ Installed${NC}"
    docker-compose --version
else
    echo -e "${RED}✗ Not found${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo ""

# Check if .env file exists
echo -n "Checking .env file... "
if [ -f .env ]; then
    echo -e "${GREEN}✓ Found${NC}"

    # Check if GROK_API_KEY is set
    if grep -q "^GROK_API_KEY=.*[a-zA-Z0-9]" .env; then
        echo -e "  ${GREEN}✓ GROK_API_KEY is set${NC}"
    else
        echo -e "  ${YELLOW}⚠ GROK_API_KEY is not set (optional but recommended)${NC}"
    fi
else
    echo -e "${RED}✗ Not found${NC}"
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo -e "${YELLOW}⚠ Please edit .env and add your GROK_API_KEY${NC}"
fi

echo ""

# Check if ports 3000 and 3001 are available
echo "Checking port availability..."

check_port() {
    PORT=$1
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
        return 1
    else
        return 0
    fi
}

echo -n "  Port 3000 (frontend): "
if check_port 3000; then
    echo -e "${GREEN}✓ Available${NC}"
else
    echo -e "${RED}✗ In use${NC}"
    echo "    Something is using port 3000. Stop it or change the port in docker-compose.yml"
fi

echo -n "  Port 3001 (backend): "
if check_port 3001; then
    echo -e "${GREEN}✓ Available${NC}"
else
    echo -e "${RED}✗ In use${NC}"
    echo "    Something is using port 3001. Stop it or change the port in docker-compose.yml"
fi

echo ""

# Check if containers are running
echo "Checking Docker containers..."
if docker-compose ps 2>/dev/null | grep -q "Up"; then
    echo -e "${GREEN}✓ Containers are running${NC}"
    docker-compose ps

    echo ""
    echo "Testing connectivity..."

    # Test backend
    echo -n "  Backend health check: "
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Responding${NC}"
    else
        echo -e "${RED}✗ Not responding${NC}"
    fi

    # Test frontend
    echo -n "  Frontend: "
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Responding${NC}"
    else
        echo -e "${RED}✗ Not responding${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Containers are not running${NC}"
    echo "Run: docker-compose up -d"
fi

echo ""
echo "=================================="
echo "Setup Verification Complete"
echo "=================================="
echo ""

# Final recommendations
echo "Next steps:"
echo "1. If containers aren't running: docker-compose up -d --build"
echo "2. Access the app: http://localhost:3000"
echo "3. Check logs if issues: docker-compose logs -f"
echo "4. For detailed troubleshooting: See DOCKER_TROUBLESHOOTING.md"
echo ""
