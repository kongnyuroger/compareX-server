# ─── Stage 1: Build ───────────────────────────────────────────────────────────
# We use a Node.js image to install dependencies and compile TypeScript
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files first (so Docker can cache this layer)
COPY package*.json ./

# Install ALL dependencies (including dev tools needed to build) and disable husky
RUN npm ci

# Copy the rest of the source code
COPY . .

# Compile TypeScript → JavaScript (outputs to /app/dist)
RUN npm run build


# ─── Stage 2: Production image ────────────────────────────────────────────────
# Start fresh with a clean image — no dev tools, smaller final size
FROM node:20-slim

WORKDIR /app

# Install Chrome + its dependencies (required by Puppeteer for crawling)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chrome we just installed
# (instead of downloading its own copy)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy package files and install ONLY production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy the compiled code from the builder stage
COPY --from=builder /app/dist ./dist

# The port your NestJS app listens on
EXPOSE 8080

# Start the app
CMD ["node", "dist/main"]