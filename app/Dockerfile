# Multi-stage build for Node.js + TypeScript application

# Stage 1: Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN pnpm install

# Copy source code and TypeScript config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript to JavaScript
RUN pnpm run build

# Stage 2: Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install production dependencies using npm
RUN npm install --production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Expose port 8000
EXPOSE 8000

# Set environment to production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["npm", "start"]

