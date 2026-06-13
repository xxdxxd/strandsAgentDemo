import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const hasApiKey = !!process.env.OPENAI_API_KEY && 
                   process.env.OPENAI_API_KEY !== 'MY_OPENAI_API_KEY' && 
                   process.env.OPENAI_API_KEY !== 'your_actual_api_key' &&
                   process.env.OPENAI_API_KEY.trim() !== '';
  return json({
    status: 'ok',
    timestamp: Date.now(),
    hasEnvKey: hasApiKey
  });
};
