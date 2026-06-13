/**
 * Strands Agent Framework - OpenAI SDK Multi-step Reasoning Client Core
 */

import OpenAI from 'openai';
import { Message, ReasoningStep, ToolType, OpenAIConfig } from '../src/types';
import { evaluateMath, fetchWeather, fetchWebPage } from './tools';

// Generate a random UUID-like ID for logs
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Sandbox Helper: Detect if weather inquiry is specified and parse city
function detectCity(text: string): string | null {
  const patterns = [
    /weather\s+in\s+([a-zA-Z\s\-]+)/i,
    /weather\s+of\s+([a-zA-Z\s\-]+)/i,
    /temperature\s+in\s+([a-zA-Z\s\-]+)/i,
    /([a-zA-Z\s\-]+)\s+weather/i,
    /forecast\s+for\s+([a-zA-Z\s\-]+)/i,
  ];
  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const city = match[1].trim();
      return city.replace(/(?:and|multiplied|times|\*|\+|-|\/).*$/i, '').trim();
    }
  }
  if (/weather|temperature|forecast|climate/i.test(text)) {
    const caps = text.match(/\b[A-Z][a-zA-Z]+\b/g);
    if (caps) return caps[0];
  }
  return null;
}

// Sandbox Helper: Detect if math formulation is requested
function detectMath(text: string): string | null {
  const clean = text.replace(/weather|temperature|in|at|[a-zA-Z\:\?\.\!]+/g, ' ').trim();
  if (/[\d\+\-\*\/\(\)\^]/.test(clean)) {
    const expr = clean.replace(/[^0-9\+\-\*\/\(\)\^\.\s]/g, '').trim();
    if (expr.length >= 1 && /[\+\-\*\/\^]/.test(expr)) {
      return expr;
    }
  }
  return null;
}

// Sandbox Helper: Detect web URLs in user prompts
function detectUrl(text: string): string | null {
  const match = text.match(/(https?:\/\/[^\s]+)/i);
  return match ? match[1] : null;
}

// High-fidelity Local Sandbox Reasoning Simulator Engine
async function runSandboxAgentLoop(
  message: string,
  enabledTools: ToolType[]
): Promise<{ answer: string; reasoningSteps: ReasoningStep[] }> {
  const reasoningSteps: ReasoningStep[] = [];
  const startTimer = Date.now();

  reasoningSteps.push({
    id: generateId(),
    timestamp: Date.now(),
    type: 'thought',
    title: 'Input Analysis (Sandbox Offline Simulation Mode)',
    details: 'No OpenAI API Key detected. Engaging high-fidelity local simulation reasoning node. Analyzing prompt query with enabled tools.'
  });

  let weatherOutput: any = null;
  let detectedCity: string | null = null;

  // 1. Weather search
  if (enabledTools.includes('weather')) {
    detectedCity = detectCity(message);
    if (detectedCity) {
      reasoningSteps.push({
        id: generateId(),
        timestamp: Date.now(),
        type: 'thought',
        title: 'Formulating Action: Weather retrieval needed',
        details: `Identified keyword/city query "${detectedCity}" requiring a real-time meteorological coordinates query.`
      });

      const callId = generateId();
      const callStart = Date.now();
      reasoningSteps.push({
        id: callId,
        timestamp: Date.now(),
        type: 'tool_call',
        title: `Executing tool: weather`,
        details: JSON.stringify({ city: detectedCity }, null, 2),
        toolName: 'weather'
      });

      try {
        weatherOutput = await runTool('weather', { city: detectedCity });
        reasoningSteps.push({
          id: generateId(),
          timestamp: Date.now(),
          type: 'tool_response',
          title: `Tool output: weather`,
          details: JSON.stringify(weatherOutput, null, 2),
          toolName: 'weather',
          elapsedMs: Date.now() - callStart
        });
      } catch (err: any) {
        reasoningSteps.push({
          id: generateId(),
          timestamp: Date.now(),
          type: 'error',
          title: `Tool failure: weather`,
          details: err.message || String(err),
          toolName: 'weather',
          elapsedMs: Date.now() - callStart
        });
      }
    }
  }

  // 2. URL loading
  let pageOutput: any = null;
  let detectedUrl: string | null = null;
  if (enabledTools.includes('fetch_url')) {
    detectedUrl = detectUrl(message);
    if (detectedUrl) {
      reasoningSteps.push({
        id: generateId(),
        timestamp: Date.now(),
        type: 'thought',
        title: 'Formulating Action: Page reader scan needed',
        details: `Discovered fully qualified domain url target: ${detectedUrl}`
      });

      const callId = generateId();
      const callStart = Date.now();
      reasoningSteps.push({
        id: callId,
        timestamp: Date.now(),
        type: 'tool_call',
        title: `Executing tool: fetch_url`,
        details: JSON.stringify({ url: detectedUrl }, null, 2),
        toolName: 'fetch_url'
      });

      try {
        pageOutput = await runTool('fetch_url', { url: detectedUrl });
        reasoningSteps.push({
          id: generateId(),
          timestamp: Date.now(),
          type: 'tool_response',
          title: `Tool output: fetch_url`,
          details: JSON.stringify(pageOutput, null, 2),
          toolName: 'fetch_url',
          elapsedMs: Date.now() - callStart
        });
      } catch (err: any) {
        reasoningSteps.push({
          id: generateId(),
          timestamp: Date.now(),
          type: 'error',
          title: `Tool failure: fetch_url`,
          details: err.message || String(err),
          toolName: 'fetch_url',
          elapsedMs: Date.now() - callStart
        });
      }
    }
  }

  // 3. Mathematical calculation
  let mathOutput: any = null;
  let mathExpr = detectMath(message);
  if (enabledTools.includes('calculator') && (mathExpr || message.toLowerCase().includes('calculate') || message.toLowerCase().includes('multiplied') || message.toLowerCase().includes('times'))) {
    
    // Substitute active weather outputs natively for sequential math
    if (weatherOutput && weatherOutput.tempF !== undefined) {
      if (!mathExpr) {
        mathExpr = `${weatherOutput.tempF} * 1.5`;
      } else {
        mathExpr = mathExpr.replace(/[a-zA-Z]+/g, String(weatherOutput.tempF));
      }
    }

    if (mathExpr) {
      reasoningSteps.push({
        id: generateId(),
        timestamp: Date.now(),
        type: 'thought',
        title: 'Formulating Action: Expression calculator needed',
        details: `Extracted math formula target: "${mathExpr}" for computation.`
      });

      const callId = generateId();
      const callStart = Date.now();
      reasoningSteps.push({
        id: callId,
        timestamp: Date.now(),
        type: 'tool_call',
        title: `Executing tool: calculator`,
        details: JSON.stringify({ expression: mathExpr }, null, 2),
        toolName: 'calculator'
      });

      try {
        mathOutput = await runTool('calculator', { expression: mathExpr });
        reasoningSteps.push({
          id: generateId(),
          timestamp: Date.now(),
          type: 'tool_response',
          title: `Tool output: calculator`,
          details: JSON.stringify(mathOutput, null, 2),
          toolName: 'calculator',
          elapsedMs: Date.now() - callStart
        });
      } catch (err: any) {
        reasoningSteps.push({
          id: generateId(),
          timestamp: Date.now(),
          type: 'error',
          title: `Tool failure: calculator`,
          details: err.message || String(err),
          toolName: 'calculator',
          elapsedMs: Date.now() - callStart
        });
      }
    }
  }

  // Build simulated final textual answer response
  const answerParts: string[] = [];
  answerParts.push(`### 🔋 Strands Offline Sandbox Simulation\n`);
  answerParts.push(`*No real OpenAI API Key was configured, so this query has been fully analyzed and executed locally inside the container's high-fidelity Sandbox Interpreter Engine.*\n`);

  if (detectedCity && weatherOutput) {
    answerParts.push(`#### 🌤️ Meteorology Report for **${weatherOutput.city || detectedCity}**:`);
    answerParts.push(`- **Temperature**: ${weatherOutput.tempF}°F (${weatherOutput.tempC}°C)`);
    answerParts.push(`- **Weather Description**: ${weatherOutput.description || 'General Weather conditions'}`);
    answerParts.push(`- **Coordinates**: Lat ${weatherOutput.latitude}, Lon ${weatherOutput.longitude}`);
    answerParts.push(`- **Atmosphere**: ${weatherOutput.humidity}% Humidity, Wind ${weatherOutput.wind_mph} mph\n`);
  }

  if (detectedUrl && pageOutput) {
    answerParts.push(`#### 📄 Static Link Scraping for **${detectedUrl}**:`);
    answerParts.push(`- **Document Title**: *${pageOutput.title || 'Fetched Page Address'}*`);
    answerParts.push(`- **Content Summary / Excerpt**:\n> ${pageOutput.excerpt?.substring(0, 480) || 'None extracted.'}...\n`);
  }

  if (mathExpr && mathOutput !== null) {
    answerParts.push(`#### 🧮 Math Calculator Result:`);
    answerParts.push(`- **Expression Evaluated**: \`${mathExpr}\``);
    answerParts.push(`- **Calculated Solution**: **${mathOutput.result !== undefined ? mathOutput.result : mathOutput}**\n`);
  }

  if (!detectedCity && !detectedUrl && !mathExpr) {
    answerParts.push(`**Received message**: "${message}"\n`);
    answerParts.push(`To fully experience the **Strands Multi-step agent trace process** in Sandbox mode, try typing one of these examples:`);
    answerParts.push(`1. 🌤️ *"What's the weather like in Tokyo?"*`);
    answerParts.push(`2. 🧮 *"Evaluate 3.5 * (12 + 45) - 2^3"*`);
    answerParts.push(`3. 🔗 *"Fetch the web content at https://example.com"*`);
    answerParts.push(`4. 🔄 *"What Celsius temperature is London and multiply that value by 10!"* (Simulates a complete sequential multi-step tool trigger pipeline!)`);
  }

  const answer = answerParts.join('\n');

  const totalDuration = Date.now() - startTimer;
  reasoningSteps.push({
    id: generateId(),
    timestamp: Date.now(),
    type: 'thought',
    title: 'Resolution Finalised (Sandbox Mode)',
    details: `Successfully evaluated sandbox tools execution and formatted markdown summary outcome. Elapsed: ${totalDuration}ms.`
  });

  return {
    answer,
    reasoningSteps
  };
}

/**
 * Initializes the OpenAI Client dynamically based on context config or standard server env keys
 */
export function getOpenAIClient(config?: OpenAIConfig): OpenAI {
  const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'MY_OPENAI_API_KEY' || apiKey.trim() === '') {
    throw new Error('OPENAI_API_KEY is not configured on the node server or in conversation settings. Please provide your API key in the configuration sidebar.');
  }

  const baseURL = config?.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  return new OpenAI({
    apiKey,
    baseURL,
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

const fetchUrlSchema = {
  type: 'function' as const,
  function: {
    name: 'fetch_url',
    description: 'Fetches static page HTML source data and parses tidy textual excerpts from web domains.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Full static internet URL Address e.g. https://example.com'
        }
      },
      required: ['url']
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
    case 'fetch_url': {
      const url = args.url;
      if (!url) throw new Error('Parameter "url" is required for fetch_url');
      return await fetchWebPage(url);
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
  if (!apiKey || apiKey === 'MY_OPENAI_API_KEY' || apiKey.trim() === '' || apiKey.trim() === 'your_actual_api_key' || apiKey.trim() === 'sk-fake-key') {
    return runSandboxAgentLoop(message, enabledTools);
  }

  const reasoningSteps: ReasoningStep[] = [];
  const startTimer = Date.now();

  // Pick suitable model
  const activeModel = openAIConfig?.model || 'gpt-4o-mini';

  // Log initial Request Setup
  reasoningSteps.push({
    id: generateId(),
    timestamp: Date.now(),
    type: 'thought',
    title: 'Input Analysis (OpenAI Model Mode)',
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
  if (enabledTools.includes('fetch_url')) tools.push(fetchUrlSchema);

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
      details: `Streaming prompt to OpenAI (${activeModel}) via base URL: ${openAIConfig?.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}. Formulating system calculations or webpage contexts.`
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
