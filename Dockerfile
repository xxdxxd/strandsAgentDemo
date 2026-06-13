# Use an official stable Ubuntu LTS base image
FROM ubuntu:22.04

# Avoid interactive prompt blocks during apt installations
ENV DEBIAN_FRONTEND=noninteractive

# Install common system dependencies needed for Node.js and builds
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install safe, official Node.js 20 LTS from NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Verify system level tool paths are operating properly
RUN node --version && npm --version

# Set worker environment directory 
WORKDIR /usr/src/app

# Copy manifest files to execute cached package installations
COPY package*.json ./

# Clean installation of npm dependencies 
RUN npm ci

# Copy the remaining codebase files across to the volume
COPY . .

# Compile and build the production bundles for SvelteKit (using node-adapter)
RUN npm run build

# Configure runtime variables
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Expose the configured local application port
EXPOSE 3000

# Start SvelteKit's standalone node-adapter build package
CMD ["node", "build/index.js"]
