# ==============================================================================
# Multi-stage Docker build for Node.js application
# ==============================================================================

# ------------------------------------------------------------------------------
# Build stage - compile and prepare the application
# ------------------------------------------------------------------------------
FROM node:18-alpine AS builder

# Set build arguments
ARG NODE_ENV=production
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Add labels for better image management
LABEL maintainer="docker-lab-team@example.com"
LABEL org.opencontainers.image.title="Docker Deployment Lab"
LABEL org.opencontainers.image.description="Node.js application for Docker deployment lab"
LABEL org.opencontainers.image.version=${VERSION}
LABEL org.opencontainers.image.created=${BUILD_DATE}
LABEL org.opencontainers.image.revision=${VCS_REF}
LABEL org.opencontainers.image.source="https://github.com/example/docker-deployment-lab"

# Install build dependencies for better security and smaller images
RUN apk add --no-cache \
    dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies with npm ci for faster, reliable builds
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Remove development files and sensitive information
RUN rm -rf \
    .git \
    .gitignore \
    .dockerignore \
    README.md \
    *.md \
    tests/ \
    .nyc_output \
    coverage/

# ------------------------------------------------------------------------------
# Production stage - create the final runtime image
# ------------------------------------------------------------------------------
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app /app

# Create and set permissions for logs directory
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "app.js"]

# ==============================================================================
# Build commands:
# docker build -t node-docker-app:latest .
# docker build -t node-docker-app:latest --build-arg VERSION=1.0.0 .
# ==============================================================================