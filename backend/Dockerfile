FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914

# Install build dependencies for native modules (better-sqlite3) and unzip for H5P
RUN apk add --no-cache python3 make g++ gcc unzip

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY vendor ./vendor

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
