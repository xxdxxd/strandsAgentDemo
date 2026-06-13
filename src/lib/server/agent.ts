/**
 * Strands Agent Framework - OpenAI SDK Multi-step Reasoning Client Core (SvelteKit server-only)
 */

import OpenAI from 'openai';
import type { Message, ReasoningStep, ToolType, OpenAIConfig } from '$lib/types';
import { evaluateMath, fetchWeather } from './tools';

// Generate a random UUID-like ID for logs
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Initializes the OpenAI Client dynamically based on context config or standard server env keys
 */
export function getOpenAIClient(config?: OpenAIConfig): OpenAI {
  const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'MY_OPENAI_API_KEY' || apiKey === 'your_actual_api_key' || apiKey.trim() === '') {
    throw new Error('OPENAI_API_KEY is not configured on the node server or in conversation settings. Please provide your API key in the configuration sidebar.');
  }

  const baseURL = config?.baseURL || process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';

  const defaultHeaders: Record<string, string> = {};
  if (baseURL.includes('openrouter.ai')) {
    defaultHeaders['HTTP-Referer'] = process.env.APP_URL || 'https://ai.studio/build';
    defaultHeaders['X-Title'] = 'Strands Agent';
  }

  return new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders,
  });
}

// Defining OpenAI Tools Schema Configurations
const calculatorToolSchema = {
  type: 'function' as const,
  function: {
    name: 'calculator',
    description: 'Calculates basic mathematical expressions. Supports operands +, -, *, /, brackets and exponents (^). Strictly enter expression string only.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to compute, e.g. "3.5 * (12 + 45)" or "2^4"'
        }
      },
      required: ['expression']
    }
  }
};

const weatherToolSchema = {
  type: 'function' as const,
  function: {
    name: 'weather',
    description: 'Retrieves coordinate locations and current Fahrenheit/Celsius temperatures for any worldwide city.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'Name of the city, e.g. "Seattle" or "Berlin"'
        }
      },
      required: ['city']
    }
  }
};

/**
 * Executes a specific tool by name and arguments
 */
async function runTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'calculator': {
      const expr = args.expression;
      if (!expr) throw new Error('Parameter "expression" is required for calculator');
      return evaluateMath(expr);
    }
    case 'weather': {
      const city = args.city;
      if (!city) throw new Error('Parameter "city" is required for weather');
      return await fetchWeather(city);
    }
    default:
      throw new Error(`Unknown tool: "${name}"`);
  }
}

/**
 * Runs the Multi-step Strands Agent OpenAI Loop
 */
export async function runAgentLoop(
  message: string,
  history: Message[],
  enabledTools: ToolType[],
  openAIConfig?: OpenAIConfig
): Promise<{ answer: string; reasoningSteps: ReasoningStep[] }> {
  const apiKey = openAIConfig?.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'MY_OPENAI_API_KEY' || apiKey === 'your_actual_api_key' || apiKey.trim() === '') {
    throw new Error('No valid OPENAI_API_KEY was provided. Please configure your OpenAI API Key in the settings panel on the left to start conversation.');
  }

  const reasoningSteps: ReasoningStep[] = [];
  const startTimer = Date.now();

  // Pick suitable model
  const activeModel = openAIConfig?.model || 'openai/gpt-4o-mini';

  // Log initial Request Setup
  reasoningSteps.push({
    id: generateId(),
    timestamp: Date.now(),
    type: 'thought',
    title: 'Input Analysis (OpenRouter Model Mode)',
    details: `Initializing chat query with target model "${activeModel}" and tools: [${enabledTools.join(', ') || 'none'}]. Analyzing prompt context and conversation history.`
  });

  // Client init
  let openai: OpenAI;
  try {
    openai = getOpenAIClient(openAIConfig);
  } catch (err: any) {
    reasoningSteps.push({
      id: generateId(),
      timestamp: Date.now(),
      type: 'error',
      title: 'Failed to initialize OpenAI Client',
      details: err.message || String(err),
    });
    throw err;
  }

  // Pick up tool schemas mapping to enabled selections
  const tools: Array<{ type: 'function'; function: any }> = [];
  if (enabledTools.includes('calculator')) tools.push(calculatorToolSchema);
  if (enabledTools.includes('weather')) tools.push(weatherToolSchema);

  // System instructions explaining agent goals & systematic guidelines
  const systemInstruction = 
    `You are a highly analytical, autonomous AI specialist utilizing the Strands Agent Framework, powered by OpenAI models. ` +
    `Your prompt is to answer the user's inquiry thoroughly and factually. ` +
    `You have permissions to execute tool calls on behalf of the user in a sequential, multi-step manner. ` +
    `When analyzing a question, list your thoughts, choose appropriate tools, process and examine their results, and loop until you have a final fully-grounded answer. ` +
    `Before calling any tool, you are encouraged to think step-by-step and write down your reasoning explanation. ` +
    `If you do not need any further tools or if you have collected sufficient data, write down the final concise solution. ` +
    `Do not hallucinate facts. If a tool fails, explain the problem and think of a fallback or inform the user.`;

  // Build OpenAI input message history list
  const messages: any[] = [
    {
      role: 'system',
      content: systemInstruction
    }
  ];

  // Convert past conversations to OpenAI messages format
  for (const item of history) {
    messages.push({
      role: item.role === 'user' ? 'user' : 'assistant',
      content: item.content
    });
  }

  // Add the newly input prompt
  messages.push({
    role: 'user',
    content: message
  });

  let loopCount = 0;
  const maxLoops = 6; // Safety ceiling
  let finalAnswer = '';

  while (loopCount < maxLoops) {
    loopCount++;
    const stepStart = Date.now();

    reasoningSteps.push({
      id: generateId(),
      timestamp: Date.now(),
      type: 'thought',
      title: `Agent reasoning loop - Turn ${loopCount}`,
      details: `Streaming prompt to OpenRouter/OpenAI (${activeModel}) via base URL: ${openAIConfig?.baseURL || process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1'}. Formulating system calculations or webpage contexts.`
    });

    // Fire ChatGPT completion call with tool definitions
    const completion = await openai.chat.completions.create({
      model: activeModel,
      messages: messages,
      tools: tools.length > 0 ? tools : undefined,
      temperature: 0.15,
    });

    const choice = completion.choices?.[0];
    if (!choice) {
      throw new Error('No completion content candidates returned from OpenAI.');
    }

    const assistantMsg = choice.message;
    
    // Append assistant's thoughts to our conversation state block
    messages.push(assistantMsg);

    const modelThoughts = assistantMsg.content || '';
    if (modelThoughts) {
      reasoningSteps.push({
        id: generateId(),
        timestamp: Date.now(),
        type: 'thought',
        title: `Model Thoughts (Turn ${loopCount})`,
        details: modelThoughts,
        elapsedMs: Date.now() - stepStart
      });
    }

    // Inspect if the model requested function tool execution
    const toolCalls = assistantMsg.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      for (const call of toolCalls) {
        const toolCallId = generateId();
        const callStart = Date.now();
        const functionName = (call as any).function.name;
        
        let toolArguments: any = {};
        try {
          toolArguments = JSON.parse((call as any).function.arguments);
        } catch (_) {
          toolArguments = { raw: (call as any).function.arguments };
        }

        reasoningSteps.push({
          id: toolCallId,
          timestamp: Date.now(),
          type: 'tool_call',
          title: `Executing tool: ${functionName}`,
          details: `Parameters:\n${JSON.stringify(toolArguments, null, 2)}`,
          toolName: functionName
        });

        try {
          // Execute!
          const output = await runTool(functionName, toolArguments);

          reasoningSteps.push({
            id: generateId(),
            timestamp: Date.now(),
            type: 'tool_response',
            title: `Tool output: ${functionName}`,
            details: JSON.stringify(output, null, 2),
            toolName: functionName,
            elapsedMs: Date.now() - callStart
          });

          // Standard OpenAI response format
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(output)
          });

        } catch (toolError: any) {
          reasoningSteps.push({
            id: generateId(),
            timestamp: Date.now(),
            type: 'error',
            title: `Tool failure: ${functionName}`,
            details: toolError.message || String(toolError),
            toolName: functionName,
            elapsedMs: Date.now() - callStart
          });

          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: toolError.message || String(toolError), failed: true })
          });
        }
      }
    } else {
      // Done! The OpenAI model did not invoke any more tool calls, and produced a final textual answer.
      finalAnswer = modelThoughts;
      break;
    }
  }

  // Safety fallback
  if (!finalAnswer) {
    const lastMsg = messages[messages.length - 1];
    finalAnswer = lastMsg?.content || 'Agent has finished but no response was produced.';
    
    reasoningSteps.push({
      id: generateId(),
      timestamp: Date.now(),
      type: 'thought',
      title: 'Safety Intercept',
      details: 'Safety maximum loops reached. Finalizing current execution frame state.'
    });
  }

  const totalDuration = Date.now() - startTimer;
  reasoningSteps.push({
    id: generateId(),
    timestamp: Date.now(),
    type: 'thought',
    title: 'Resolution Finalised',
    details: `Successfully evaluated OpenAI agent prompt response. Total period: ${totalDuration}ms.`
  });

  return {
    answer: finalAnswer,
    reasoningSteps
  };
}
