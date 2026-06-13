import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runAgentLoop } from '$lib/server/agent';
import type { ChatRequest } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { message, history, enabledTools, openAIConfig } = await request.json() as ChatRequest;

    if (!message || message.trim() === '') {
      return json({ error: 'Message content cannot be blank' }, { status: 400 });
    }

    // Run our agentic reasoning loop using OpenAI
    const result = await runAgentLoop(message, history || [], enabledTools || [], openAIConfig);
    
    return json(result);
  } catch (err: any) {
    console.error('Agent loop execution crash:', err);
    return json({
      error: err.message || 'An unexpected failure occurred in the Strands Agent loop.'
    }, { status: 550 });
  }
};
