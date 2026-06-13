# Strands Agent (SvelteKit Edition)

An interactive SvelteKit application utilizing the Strands Agent Framework to execute multi-step tool calls for math computations and live weather searches. Built with Svelte 5 structure, styled with Tailwind CSS, and optimized for secure, responsive server-side processing.

---

## 🔒 Configuration & API Keys

To run this codebase on an **Ubuntu Linux** computer (or any local/virtual server), you should use an **environment file** rather than hardcoding credentials or loading them directly in front-end states. This ensures absolute security and protects against API key leaks.

### Config File
The application uses a `.env` file loaded in SvelteKit's server context.

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
This boots up SvelteKit’s development environment, proxying both front-end and back-end logic under a single unified process:

```bash
npm run dev
```

Your app will execute locally and can be accessed at:
- Dev URL: **`http://localhost:3000`**

### 4. Build and Run in Production Mode
To run SvelteKit optimized for production with optimal performance, compile the static assets and server code using SvelteKit's Node adapter:

```bash
# Compile and build the SvelteKit application for Node adapter deployment
npm run build

# Start the optimized Node server output folder
npm run start
```

---

## 🛠️ Diagnostics & Features Overview

* **SvelteKit Server Routes**: All API calls (such as OpenRouter/OpenAI interactions) are handled inside `/src/routes/api/*` routes, entirely isolated server-side so API keys are never exposed to the client browser.
* **Svelte 5 Runes**: Utilizes advanced `$state`, `$derived`, and `$effect` reactive concepts for instantaneous UI updates and elegant chat timelines.
* **Git Leak Protection**: Root rules inside `.gitignore` automatically filter and exclude `.env` configurations from being checked into remote commits.

---

## 🧠 Why is the Build Process Long in Sandbox?

If you notice that `npm run build` or the workspace compilation takes several seconds or minutes, this is entirely normal and expected. Here is why:

1. **Virtualized Container Resource Constraints**: In online sandboxes and cloud environments, resources (CPU, RAM, Disk I/O) are shared across multiple tenants. Node compilation is highly CPU-bound and Disk I/O-intensive, which slows down during high container concurrency.
2. **SvelteKit Double Compile Phase**: During `vite build`, Vite compiles **two separate bundles**: a client-side bundle (for the browser UI) and a server-side bundle (for SSR/node-adapter runtime handling).
3. **Tailwind compilation & post-processing**: The Tailwind CSS engine scans the entire file system for styles, transforms classes, and optimizes them into a single CSS payload for maximal compression, which adds extra compilation steps.
4. **Adapter Optimization**: SvelteKit's Node adapter post-processes the compiled bundles into a standalone, portable entrypoint file inside the `build/` directory with full optimization steps, compressing static files where possible.

