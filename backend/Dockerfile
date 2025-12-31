FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size (optional)
RUN npm prune --production

# Expose port
EXPOSE 3001

# Initialize database and start server
CMD ["sh", "-c", "npm run db:init && npm start"]
