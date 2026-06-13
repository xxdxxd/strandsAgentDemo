/**
 * Main Full-Stack Server Entrypoint (Express + Vite Server-Side Core)
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { runAgentLoop } from './server/agent';
import { ChatRequest } from './src/types';

// Load environment configurations
import dotenv from 'dotenv';
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Server configurations for full payloads (e.g., website context text digests)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 1. API - Health Checker
  app.get('/api/health', (req: Request, res: Response) => {
    const hasApiKey = !!process.env.OPENAI_API_KEY && 
                     process.env.OPENAI_API_KEY !== 'MY_OPENAI_API_KEY' && 
                     process.env.OPENAI_API_KEY !== 'your_actual_api_key' &&
                     process.env.OPENAI_API_KEY.trim() !== '';
    res.status(200).json({ 
      status: 'ok', 
      timestamp: Date.now(),
      hasEnvKey: hasApiKey
    });
  });

  // 2. API - Core Chat Orchestration Trigger
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { message, history, enabledTools, openAIConfig } = req.body as ChatRequest;

      if (!message || message.trim() === '') {
        res.status(400).json({ error: 'Message content cannot be blank' });
        return;
      }

      // Run our agentic reasoning loop using OpenAI
      const result = await runAgentLoop(message, history || [], enabledTools || [], openAIConfig);
      
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Agent loop execution crash:', error);
      res.status(500).json({
        error: error.message || 'An unexpected failure occurred in the Strands Agent loop.'
      });
    }
  });

  // 3. Vite Middleware Setup (Development vs. Production Modes)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    // Utilize Vite's connect middleware to serve standard client assets
    app.use(vite.middlewares);
    console.log('[System] Vite development server loaded on Port 3000 (Middleware mode).');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[System] Production environment serving pre-built static client.');
  }

  // Bind to host 0.0.0.0 and port 3000 required for standard ingress routing
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Runtime] Strands Chatbot Server executing gracefully on: http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Failure] Fails to launch Node.js execution container:', err);
});
