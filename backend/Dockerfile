FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm install -D typescript tsx @types/node && npm run build

# Expose port
EXPOSE 3001

# Initialize database and start server
CMD ["sh", "-c", "npm run db:init && npm start"]
