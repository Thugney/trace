FROM node:20-alpine

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ gcc

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for building)
RUN npm ci

# Force rebuild of native module for Alpine/musl
RUN npm rebuild better-sqlite3 --build-from-source

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size (optional)
RUN npm prune --production

# Expose port
EXPOSE 3001

# Start server (database init happens automatically in index.ts)
CMD ["npm", "start"]
