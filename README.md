# Strands Agent

A secure, modern full-stack developer agent chat orchestration interface running with full-stack capabilities, styled with Tailwind CSS, and optimized for reliable performance.

---

## 🔒 Configuration & API Keys

To run this codebase on an **Ubuntu Linux** computer (or any local/virtual server), you should use an **environment file** rather than hardcoding credentials or loading them directly in front-end states. This ensures absolute security and protects against API key leaks.

### Config File
The application uses a `.env` file loaded in the backend node context.

1. Locate the `.env.example` template in the root directory.
2. Duplicate it and rename it to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and specify your credentials:
   ```env
   # Your OpenRouter or OpenAI API Key
   OPENAI_API_KEY="your_actual_api_key"

   # Base URL (defaults to OpenRouter if not specified)
   OPENAI_BASE_URL="https://openrouter.ai/api/v1"
   ```

---

## 🐧 Ubuntu Linux Setup Instructions

Follow these quick-start instructions to prepare your environment and launch the agent.

### 1. Update Packages & Install Prerequisites
Ensure standard system tools and a modern version of **Node.js (v20.x or higher)** are installed.

```bash
# Update Ubuntu package lists
sudo apt update && sudo apt upgrade -y

# Install curl, git, and build essentials
sudo apt install -y curl git build-essential

# Install Node.js LTS (v20.x) via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation versions
node -v
npm -v
```

### 2. Install Project Dependencies
Navigate to the root directory of this codebase and install the required npm dependencies:

```bash
# Install package dependencies
npm install
```

### 3. Run the Development Server
This boots up the fast TypeScript execution environment (`tsx`) proxying both front-end and back-end logic under a single unified process:

```bash
npm run dev
```

Your app will execute locally and can be accessed at:
- Dev URL: **`http://localhost:3000`**

### 4. Build and Run in Production Mode
For optimal speed, routing performance, and production-ready static-file service:

```bash
# Compile client assets with Vite and package server code with esbuild in CommonJS form
npm run build

# Direct Node launch on port 3000
npm run start
```

---

## 🛠️ Diagnostics & Features Overview

* **Unified Express Server**: Proxies all OpenAI or OpenRouter client requests, keeping secrets completely safe on the server side (avoiding leaking keys to browser inspect tabs or raw JS downloads).
* **Git Leak Protection**: Root rules inside `.gitignore` automatically filter and exclude `.env` configurations from being checked into remote commits.
* **TypeScript Built**: Built natively with complete static typings under `@types/node` and compiled using `esbuild` for immediate startup performance.
