<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { slide } from 'svelte/transition';
  import type { ChatSession, Message, ToolType, ToolDefinition, ReasoningStep } from '$lib/types';
  import ReasoningView from '$lib/components/ReasoningView.svelte';

  import { 
    Bot, 
    User, 
    Send, 
    Sparkles, 
    Calculator, 
    CloudSun, 
    Settings, 
    Check, 
    RotateCcw, 
    HelpCircle,
    AlertCircle,
    Loader,
    ChevronRight,
    Sliders,
    Eye,
    EyeOff,
    ShieldCheck,
    ShieldAlert,
    Trash2
  } from 'lucide-svelte';

  const AVAILABLE_TOOLS: ToolDefinition[] = [
    {
      id: 'calculator',
      name: 'Math Calculator',
      description: 'Solves complex math expressions including parentheses and exponent arithmetic.',
      icon: 'calculator',
      parameterDescription: 'Expression: format e.g. "3 * (12 + 45) / 2^3"'
    },
    {
      id: 'weather',
      name: 'Live Weather',
      description: 'Obtains coordinates and live temperature conditions for any global city.',
      icon: 'weather',
      parameterDescription: 'City: format e.g. "Tokyo" or "Paris, FR"'
    }
  ];

  const SUGGESTED_PROMPTS = [
    {
      text: "What is the temperature in Sydney multiplied by 3.5?",
      tools: ['calculator', 'weather'] as ToolType[],
      label: "Weather ➔ Math combination"
    },
    {
      text: "Compare temperatures of Paris and Berlin. What is the difference?",
      tools: ['calculator', 'weather'] as ToolType[],
      label: "Multi-city Comparison"
    },
    {
      text: "Calculate result of: (450 * 12) / (5.5 * 3^2)",
      tools: ['calculator'] as ToolType[],
      label: "Pure Pure Calculator"
    }
  ];

  const PRESET_MODELS = [
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)' },
    { id: 'openai/gpt-4o', label: 'GPT-4o (OpenAI)' },
    { id: 'openai/o1-mini', label: 'o1-mini (OpenAI)' },
    { id: 'openai/o3-mini', label: 'o3-mini (OpenAI)' },
    { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
    { id: 'deepseek/deepseek-reasoner', label: 'DeepSeek R1' },
  ];

  const getInitialSessions = (): ChatSession[] => {
    if (browser) {
      try {
        const saved = localStorage.getItem('strands_agent_sessions');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn("Could not parse saved chat sessions.", e);
      }
    }
    
    return [
      {
        id: 'default-session-id',
        title: 'First Chat Conversation',
        createdAt: Date.now(),
        enabledTools: ['calculator', 'weather'],
        messages: [
          {
            id: 'welcome',
            role: 'model',
            content: "Hello! I am a Strands Agent. I can run sequential, multi-step actions using the tools enabled on the left panel.\n\nType in questions requiring live data or computations, and you will be able to trace my thoughts and calculations in real-time!",
            timestamp: Date.now()
          }
        ]
      }
    ];
  };

  // State initialization with Svelte 5 Runes
  let sessions = $state<ChatSession[]>(getInitialSessions());
  let activeSessionId = $state<string>(getInitialSessions()[0]?.id || 'default-session-id');
  let inputMessage = $state<string>('');
  let enabledTools = $state<ToolType[]>(['calculator', 'weather']);
  let isLoading = $state<boolean>(false);
  let errorBanner = $state<string | null>(null);

  // OpenRouter keys and configs
  let openAIApiKey = $state<string>('');
  let showApiKeyText = $state<boolean>(false);
  let openAIBaseURL = $state<string>('https://openrouter.ai/api/v1');
  let openAIModel = $state<string>('openai/gpt-4o-mini');
  
  // Real-time server connectivity health checker
  let serverStatus = $state<'checking' | 'connected' | 'error'>('checking');
  let hasServerEnvKey = $state<boolean>(false);

  let chatScrollContainer = $state<HTMLDivElement | null>(null);

  onMount(() => {
    // Read from localStorage safely in browser
    if (browser) {
      openAIApiKey = localStorage.getItem('strands_openai_key') || '';
      openAIBaseURL = localStorage.getItem('strands_openai_base_url') || 'https://openrouter.ai/api/v1';
      openAIModel = localStorage.getItem('strands_openai_model') || 'openai/gpt-4o-mini';
      
      const sessionList = getInitialSessions();
      sessions = sessionList;
      activeSessionId = sessionList[0].id;
      enabledTools = sessionList[0].enabledTools || ['calculator', 'weather'];
    }

    testHealth();
  });

  // Sync session changes back to localStorage
  $effect(() => {
    if (browser && sessions.length > 0) {
      localStorage.setItem('strands_agent_sessions', JSON.stringify(sessions));
    }
  });

  // Sync OpenAI client parameter selections
  $effect(() => {
    if (browser) {
      localStorage.setItem('strands_openai_key', openAIApiKey);
    }
  });

  $effect(() => {
    if (browser) {
      localStorage.setItem('strands_openai_base_url', openAIBaseURL);
    }
  });

  $effect(() => {
    if (browser) {
      localStorage.setItem('strands_openai_model', openAIModel);
    }
  });

  // Derived properties with Svelte 5 $derived Rune
  let activeSession = $derived(sessions.find(s => s.id === activeSessionId) || sessions[0]);

  // Auto-scroll on changes using $effect
  $effect(() => {
    const msgs = activeSession?.messages;
    if (msgs && chatScrollContainer) {
      tick().then(() => {
        if (chatScrollContainer) {
          chatScrollContainer.scrollTo({
            top: chatScrollContainer.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    }
  });

  // Check server connection status
  const testHealth = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        serverStatus = 'connected';
        hasServerEnvKey = !!data.hasEnvKey;
      } else {
        serverStatus = 'error';
      }
    } catch (err) {
      serverStatus = 'error';
    }
  };

  const toggleTool = (toolId: ToolType) => {
    const updated = enabledTools.includes(toolId)
      ? enabledTools.filter(t => t !== toolId)
      : [...enabledTools, toolId];
    
    enabledTools = updated;

    // Persist to current session object
    if (activeSession) {
      sessions = sessions.map(s => {
        if (s.id === activeSession.id) {
          return { ...s, enabledTools: updated };
        }
        return s;
      });
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const messageToSend = customPrompt || inputMessage;
    if (!messageToSend || messageToSend.trim() === '' || isLoading) return;

    if (!customPrompt) {
      inputMessage = '';
    }

    // Capture standard structure
    const userMsgId = 'msg-' + Math.random().toString(36).substring(7);
    const newUserMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: messageToSend,
      timestamp: Date.now()
    };

    // Update session store immediately
    let updatedHistory: Message[] = [];
    sessions = sessions.map(s => {
      if (s.id === activeSession.id) {
        const newMsgs = [...s.messages, newUserMessage];
        updatedHistory = newMsgs;
        return { 
          ...s, 
          messages: newMsgs,
          title: s.title === 'First Chat Conversation' && s.messages.length <= 1 
            ? messageToSend.substring(0, 36) + (messageToSend.length > 36 ? '...' : '')
            : s.title
        };
      }
      return s;
    });

    isLoading = true;
    errorBanner = null;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: messageToSend,
          history: updatedHistory.slice(0, -1), // Everything except the newly injected message
          enabledTools: enabledTools,
          openAIConfig: {
            apiKey: openAIApiKey.trim() || undefined,
            baseURL: openAIBaseURL.trim() || undefined,
            model: openAIModel.trim() || undefined
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP request failure status code: ${response.status}`);
      }

      const outcome = await response.json();
      
      const responseMsgId = 'msg-' + Math.random().toString(36).substring(7);
      const newModelMessage: Message = {
        id: responseMsgId,
        role: 'model',
        content: outcome.answer || "I've processed your instructions, but no output text response was compiled.",
        timestamp: Date.now(),
        reasoningSteps: outcome.reasoningSteps
      };

      sessions = sessions.map(s => {
        if (s.id === activeSession.id) {
          return {
            ...s,
            messages: [...s.messages, newModelMessage]
          };
        }
        return s;
      });
    } catch (err: any) {
      console.error("Agent error:", err);
      errorBanner = err.message || "An issue occurred while running the agentic query cycle.";
    } finally {
      isLoading = false;
    }
  };

  const createNewSession = () => {
    const newId = 'session-' + Date.now();
    const freshSession: ChatSession = {
      id: newId,
      title: `Conversation ${sessions.length + 1}`,
      createdAt: Date.now(),
      enabledTools: [...enabledTools],
      messages: [
        {
          id: 'welcome-' + newId,
          role: 'model',
          content: "Starting a new clean agent dialog! Enable or disable tools in the navigation drawer, then prompt me with questions.",
          timestamp: Date.now()
        }
      ]
    };
    sessions = [freshSession, ...sessions];
    activeSessionId = newId;
  };

  const deleteSession = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      // Clear current messages but keep database structured
      sessions = [{
        id: 'default-session-id',
        title: 'First Chat Conversation',
        createdAt: Date.now(),
        enabledTools: ['calculator', 'weather'],
        messages: [{
          id: 'welcome-reset',
          role: 'model',
          content: "Conversations wiped clean. Start asking questions needing tools and multithread reasoning!",
          timestamp: Date.now()
        }]
      }];
      activeSessionId = 'default-session-id';
      return;
    }

    const filtered = sessions.filter(s => s.id !== id);
    sessions = filtered;
    if (activeSessionId === id) {
      activeSessionId = filtered[0].id;
    }
  };
</script>

<div id="app-container" class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col">
  <!-- Primary Top Bar -->
  <header class="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 shrink-0 flex items-center justify-between shadow-xs">
    <div class="flex items-center gap-3">
      <div class="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
        <Sparkles class="w-5 h-5 animate-pulse" />
      </div>
      <div>
        <h1 class="text-md font-bold tracking-tight">Strands Agent</h1>
        <p class="text-[11px] text-slate-500 dark:text-slate-400">Multi-turn tool-calling reasoning loop (SvelteKit Edition)</p>
      </div>
    </div>

    <!-- Server Indicator Status and Environment Tags -->
    <div class="flex items-center gap-2">
      {#if serverStatus === 'checking'}
        <span class="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
          <Loader class="w-3.5 h-3.5 animate-spin" />
          Verifying link...
        </span>
      {:else}
        {#if serverStatus === 'connected'}
          <span class="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            SvelteKit Orchestrator Online
          </span>
        {:else}
          <span class="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 rounded-full border border-rose-100 dark:border-rose-800">
            <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            Orchestrator Offline
          </span>
        {/if}
      {/if}
    </div>
  </header>

  <!-- Main Layout Area -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Left Side Sidebar - Tool Preferences & Suggested Presets -->
    <aside class="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 hidden md:flex">
      <!-- Section: Sessions Controls -->
      <div class="p-4 border-b border-slate-100 dark:border-slate-800">
        <button 
          onclick={createNewSession}
          class="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
        >
          <Bot class="w-4 h-4" />
          New Agent Session
        </button>
      </div>

      <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        <!-- Conversations list -->
        <div>
          <h3 class="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-1">
            Recent Chats
          </h3>
          <div class="space-y-1">
            {#each sessions as s (s.id)}
              {@const isActive = s.id === activeSessionId}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div 
                onclick={() => {
                  activeSessionId = s.id;
                  if (s.enabledTools) enabledTools = s.enabledTools;
                }}
                class="group w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors {
                  isActive 
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium' 
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-450'
                }"
              >
                <span class="truncate flex-1 font-medium">{s.title || "First Chat Conversation"}</span>
                <button 
                  onclick={(e) => deleteSession(e, s.id)}
                  class="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-0.5 rounded text-[10px]"
                  title="Delete conversation"
                >
                  ✕
                </button>
              </div>
            {/each}
          </div>
        </div>

        <!-- Section: Active Service Tools Selection -->
        <div>
          <div class="flex items-center justify-between mb-3 px-1">
            <h3 class="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Enabled Tools
            </h3>
            <span class="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/40">
              {enabledTools.length}/{AVAILABLE_TOOLS.length} Ready
            </span>
          </div>

          <div class="space-y-2">
            {#each AVAILABLE_TOOLS as tool (tool.id)}
              {@const isEnabled = enabledTools.includes(tool.id)}
              <button
                onclick={() => toggleTool(tool.id)}
                class="w-full text-left p-3 rounded-xl border transition-all flex gap-3 cursor-pointer {
                  isEnabled
                    ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-2xs'
                    : 'bg-transparent border-dashed border-slate-200 dark:border-slate-800/60 text-slate-400 dark:text-slate-600'
                }"
                id="tool-btn-{tool.id}"
              >
                <div class="p-2 rounded-lg shrink-0 {
                  isEnabled ? 'bg-white dark:bg-slate-850 shadow-xs border border-slate-100 dark:border-slate-800' : 'bg-slate-100 dark:bg-slate-900'
                }">
                  {#if tool.id === 'calculator'}
                    <Calculator class="w-4 h-4 text-emerald-500" />
                  {:else if tool.id === 'weather'}
                    <CloudSun class="w-4 h-4 text-amber-500" />
                  {/if}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-1">
                    <span class="font-semibold text-xs truncate">{tool.name}</span>
                    {#if isEnabled}
                      <div class="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <Check class="w-2.5 h-2.5" />
                      </div>
                    {:else}
                      <span class="text-[9px] font-medium tracking-wide text-slate-400 uppercase">Disabled</span>
                    {/if}
                  </div>
                  <p class="text-[11px] leading-snug mt-1 text-slate-500 dark:text-slate-400 font-normal">
                    {tool.description}
                  </p>
                  {#if isEnabled}
                    <div class="mt-1 text-[9px] font-mono leading-none py-1 px-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 truncate">
                      {tool.parameterDescription}
                    </div>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
          <p class="text-[10px] text-slate-400/85 dark:text-slate-500/85 mt-2.5 px-1 leading-normal">
            Select tools to dictate which capabilities are exposed for OpenAI to analyze.
          </p>
        </div>

        <!-- Suggested test scenarios -->
        <div>
          <h3 class="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-1">
            Suggested Scenarios
          </h3>
          <div class="space-y-2">
            {#each SUGGESTED_PROMPTS as samp, idx}
              <button
                disabled={isLoading}
                onclick={() => {
                  enabledTools = samp.tools;
                  handleSendMessage(samp.text);
                }}
                class="w-full text-left p-2.5 rounded-lg border border-slate-150 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 hover:bg-blue-50/30 hover:border-blue-200 dark:hover:bg-blue-950/25 dark:hover:border-blue-900/40 transition-all text-xs outline-none disabled:opacity-50 cursor-pointer"
              >
                <div class="text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 mb-1">
                  <ChevronRight class="w-3 h-3" />
                  <span>{samp.label}</span>
                </div>
                <p class="text-slate-600 dark:text-slate-300 font-medium leading-relaxed font-sans">{samp.text}</p>
                <div class="flex gap-1.5 mt-1.5">
                  {#each samp.tools as t}
                    <span class="text-[8px] font-semibold tracking-wider bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-450 px-1 rounded uppercase font-mono">
                      {t}
                    </span>
                  {/each}
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- OpenRouter & OpenAI Configuration preferences -->
        <div class="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3.5">
          <div class="flex items-center gap-2 px-1 border-b border-transparent">
            <Sliders class="w-3.5 h-3.5 text-blue-655 dark:text-blue-400" />
            <h3 class="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              OpenRouter Settings
            </h3>
          </div>

          <div class="space-y-2.5 px-1">
            <div>
              <div class="flex justify-between items-center mb-1">
                <label for="api-key-input" class="block text-[10px] font-semibold text-slate-505 dark:text-slate-400">
                  API Key (OpenRouter or OpenAI)
                </label>
                {#if openAIApiKey}
                  <button
                    type="button"
                    onclick={() => {
                      openAIApiKey = '';
                      if (browser) {
                        localStorage.removeItem('strands_openai_key');
                      }
                    }}
                    class="text-[9px] text-red-500 hover:text-red-600 dark:text-red-400 flex items-center gap-0.5 outline-none font-medium cursor-pointer"
                    title="Clear API Key from Browser LocalStorage"
                  >
                    <Trash2 class="w-2.5 h-2.5" />
                    <span>Clear Saved Key</span>
                  </button>
                {/if}
              </div>
              <div class="relative">
                <input
                  id="api-key-input"
                  type={showApiKeyText ? "text" : "password"}
                  bind:value={openAIApiKey}
                  placeholder={hasServerEnvKey ? "✔ Using server environment key" : "sk-or-... (Falls back to env settings)"}
                  class="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-2 pr-8 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono text-slate-800 dark:text-slate-200"
                />
                <button
                  type="button"
                  onclick={() => showApiKeyText = !showApiKeyText}
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 outline-none cursor-pointer"
                >
                  {#if showApiKeyText}
                    <EyeOff class="w-3.5 h-3.5" />
                  {:else}
                    <Eye class="w-3.5 h-3.5" />
                  {/if}
                </button>
              </div>
              
              <!-- Dynamic security and Git Leak prevention indicator -->
              <div class="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/80 text-[10px] leading-relaxed space-y-1.5">
                {#if hasServerEnvKey}
                  <div class="flex items-start gap-1.5 text-emerald-600 dark:text-emerald-400 animate-fade-in">
                    <ShieldCheck class="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <div>
                      <span class="font-semibold">Secure Key Detected:</span> A server-side environment key is currently active. You can safely leave this input completely blank.
                    </div>
                  </div>
                {:else}
                  <div class="flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
                    <ShieldAlert class="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <div>
                      <span class="font-semibold">No Host Key Detected:</span> Defaulting to client key provided above or system default sandbox.
                    </div>
                  </div>
                {/if}
                <div class="text-slate-500 dark:text-slate-400 border-t border-slate-150/40 dark:border-slate-800/40 pt-1.5 text-[9px]">
                  🔒 <span class="font-semibold text-slate-600 dark:text-slate-350">GitHub Leak Protection:</span> Your server-side settings reside in <code>.env</code> which is fully ignored in <code>.gitignore</code> (rules for <code>.env*</code> are pre-configured). Storing credentials on your host backend prevents secrets from ever reaching your GitHub commits.
                </div>
              </div>
            </div>

            <div>
              <label for="base-url-input" class="block text-[10px] font-semibold text-slate-505 dark:text-slate-400 mb-1">
                Base URL (Endpoint)
              </label>
              <input
                id="base-url-input"
                type="text"
                bind:value={openAIBaseURL}
                placeholder="https://openrouter.ai/api/v1"
                class="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label for="model-preset-select" class="block text-[10px] font-semibold text-slate-505 dark:text-slate-400 mb-1">
                Language Model Preset
              </label>
              <select
                id="model-preset-select"
                value={PRESET_MODELS.some(p => p.id === openAIModel) ? openAIModel : 'custom'}
                onchange={(e) => {
                  const val = (e.target as HTMLSelectElement).value;
                  if (val === 'custom') {
                    openAIModel = 'openai/gpt-4-turbo';
                  } else {
                    openAIModel = val;
                  }
                }}
                class="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                {#each PRESET_MODELS as preset}
                  <option value={preset.id} class="bg-white dark:bg-slate-900">
                    {preset.label}
                  </option>
                {/each}
                <option value="custom" class="bg-white dark:bg-slate-900">Custom Model ID...</option>
              </select>
            </div>

            {#if !PRESET_MODELS.some(p => p.id === openAIModel)}
              <div transition:slide={{ duration: 150 }}>
                <label for="custom-model-input" class="block text-[10px] font-semibold text-slate-505 dark:text-slate-400 mb-1">
                  Custom Model Identifier
                </label>
                <input
                  id="custom-model-input"
                  type="text"
                  bind:value={openAIModel}
                  placeholder="e.g. openai/gpt-4o"
                  class="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono text-slate-850 dark:text-slate-200"
                />
              </div>
            {/if}
          </div>
        </div>

      </div>
    </aside>

    <!-- Center Canvas Area: Conversation Threads -->
    <main class="flex-1 flex flex-col min-w-0 bg-slate-55 dark:bg-slate-925">
      <!-- Quick-toggle settings bar for mobile viewports -->
      <div class="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex gap-2 overflow-x-auto">
        {#each AVAILABLE_TOOLS as tool (tool.id)}
          {@const isEnabled = enabledTools.includes(tool.id)}
          <button
            onclick={() => toggleTool(tool.id)}
            class="text-xs px-3 py-1.5 rounded-full border shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer {
              isEnabled 
                ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold' 
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-450'
            }"
          >
            {#if tool.id === 'calculator'}
              <Calculator class="w-3.5 h-3.5 text-emerald-500" />
            {:else if tool.id === 'weather'}
              <CloudSun class="w-3.5 h-3.5 text-amber-500" />
            {/if}
            <span>{tool.name.split(' ')[0]}</span>
          </button>
        {/each}
        <button 
          onclick={createNewSession}
          class="text-xs px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-full font-semibold shrink-0 ml-auto cursor-pointer"
        >
          + Chat
        </button>
      </div>

      <!-- Top Info Banner if API keys are basic placeholders -->
      <div class="bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-850 px-6 py-2 flex items-center justify-between text-[11px] text-slate-400/80">
        <div class="flex items-center gap-1.5 truncate">
          <span class="font-bold uppercase bg-slate-200/65 dark:bg-slate-800 text-slate-600 px-1.5 py-0.5 rounded text-[9px]">SYSTEM</span>
          <span class="truncate">Strands framework ensures secure local sandbox environments.</span>
        </div>
        <span>v1.2.0</span>
      </div>

      <!-- Chat Bubble timeline -->
      <!-- svelte-ignore element_invalid_self_closing_tag -->
      <div 
        bind:this={chatScrollContainer}
        class="flex-grow overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar"
      >
        {#if activeSession}
          {#each activeSession.messages as message (message.id)}
            {@const isUser = message.role === 'user'}
            <div class="flex gap-4 {isUser ? 'justify-end' : 'justify-start'} animate-fade-in">
              <!-- Persona Avatars -->
              {#if !isUser}
                <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center shadow-xs border border-blue-200/20 shrink-0">
                  <Bot class="w-5 h-5" />
                </div>
              {/if}

              <div class="max-w-4xl min-w-[200px] {isUser ? 'w-auto' : 'w-full'}">
                <div class="rounded-2xl p-4 md:p-5 shadow-sm border {
                  isUser
                    ? 'bg-blue-600 dark:bg-blue-600 text-white border-blue-500/10 rounded-br-none ml-12'
                    : 'bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-850 rounded-bl-none mr-12'
                }">
                  <!-- Sub header info -->
                  <div class="flex items-center justify-between gap-4 mb-2 opacity-75 text-[10px]">
                    <span class="font-semibold flex items-center gap-1">
                      {#if isUser}
                        <User class="w-3 h-3" />
                      {:else}
                        <Bot class="w-3 h-3" />
                      {/if}
                      {isUser ? 'You' : 'Strands Agent'}
                    </span>
                    <span>
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <!-- Msg text -->
                  <div class="text-sm leading-relaxed whitespace-pre-wrap break-words font-sans selection:bg-blue-200 dark:selection:bg-blue-800">
                    {message.content}
                  </div>
                </div>

                <!-- Associated Multi-turn core reasoning path -->
                {#if !isUser && message.reasoningSteps && message.reasoningSteps.length > 0}
                  <ReasoningView steps={message.reasoningSteps} />
                {/if}
              </div>

              {#if isUser}
                <div class="w-8 h-8 rounded-lg bg-emerald-150 dark:bg-emerald-950/35 text-emerald-800 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-250/15">
                  <User class="w-5 h-5" />
                </div>
              {/if}
            </div>
          {/each}
        {/if}

        <!-- Simulated Live Processing thought cards -->
        {#if isLoading}
          <div class="flex gap-4 items-start animate-fade-in">
            <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 shadow-xs">
              <Bot class="w-5 h-5" />
            </div>
            <div class="w-full max-w-4xl space-y-3">
              <div class="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-2xl p-5 shadow-xs flex items-center gap-3">
                <Loader class="w-4 h-4 text-blue-500 animate-spin" />
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
                  Strands Agent is reasoning... executing multi-step tools if required.
                </span>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Screen Error Notification Banner -->
      {#if errorBanner}
        <div transition:slide={{ duration: 150 }} class="mx-6 md:mx-8 mb-2 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5 shadow-sm">
          <AlertCircle class="w-4.5 h-4.5 text-rose-500 shrink-0" />
          <div class="flex-1">
            <span class="font-semibold block mb-0.5">Execution Exception</span>
            <p class="opacity-95 leading-relaxed">{errorBanner}</p>
          </div>
          <button 
            onclick={() => errorBanner = null}
            class="hover:bg-rose-100 dark:hover:bg-rose-900/60 p-1 px-2 rounded-md font-mono text-[10px] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      {/if}

      <!-- User Input controls Form -->
      <footer class="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6 shrink-0 shadow-inner">
        <form 
          onsubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          class="flex gap-3 max-w-4xl mx-auto items-end"
        >
          <div class="flex-grow relative">
            <textarea
              bind:value={inputMessage}
              onkeydown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
              placeholder="Send instructions... (e.g., &ldquo;What is {new Date().getFullYear() - 1999} * 57.5?&rdquo; or weather queries)"
              rows={2}
              class="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3 pr-10 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 disabled:opacity-60 resize-none font-sans custom-scrollbar"
            ></textarea>
            
            <!-- Visual Tool Quick Stats Indicators -->
            <div class="absolute right-3.5 bottom-3.5 flex items-center gap-1.5 opacity-60">
              <HelpCircle 
                class="w-4 h-4 text-slate-450 cursor-help" 
                title="Press Enter to send. Shift+Enter for new line."
              />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <!-- Reset dialogue controls -->
            <button
              type="button"
              title="Wipe active chat histories"
              onclick={() => {
                if (confirm("Are you sure you want to clear this entire conversation history?")) {
                  sessions = sessions.map(s => {
                    if (s.id === activeSession.id) {
                      return {
                        ...s,
                        messages: [{
                          id: 'welcome-clear-' + Date.now(),
                          role: 'model',
                          content: "Chat history cleared. Send instructions anytime!",
                          timestamp: Date.now()
                        }]
                      };
                    }
                    return s;
                  });
                }
              }}
              class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-red-500 transition-colors bg-white dark:bg-slate-900 shadow-xs h-10 w-10 flex items-center justify-center cursor-pointer"
            >
              <RotateCcw class="w-4.5 h-4.5" />
            </button>

            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              class="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-150 dark:disabled:bg-slate-850 disabled:text-slate-400 text-white rounded-xl p-2.5 transition-all text-sm font-semibold h-10 w-10 flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/10"
            >
              {#if isLoading}
                <Loader class="w-4.5 h-4.5 animate-spin" />
              {:else}
                <Send class="w-4.5 h-4.5" />
              {/if}
            </button>
          </div>
        </form>
        
        <!-- Enabled tags label list footer -->
        <div class="flex items-center justify-center gap-3 mt-3 text-[10px] text-slate-400 dark:text-slate-500">
          <span class="font-semibold uppercase tracking-wider text-[9px]">Tools active in dialog:</span>
          <div class="flex gap-2">
            {#if enabledTools.length === 0}
              <span class="text-amber-500 font-semibold italic flex">No tools enabled (Standard LLM Response Only)</span>
            {:else}
              {#each enabledTools as t}
                <span class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded text-slate-600 dark:text-slate-450 font-medium">
                  {#if t === 'calculator'}
                    <Calculator class="w-3.5 h-3.5 text-emerald-500" />
                  {:else if t === 'weather'}
                    <CloudSun class="w-3.5 h-3.5 text-amber-500" />
                  {/if}
                  <span class="capitalize">{t.replace('_', ' ')}</span>
                </span>
              {/each}
            {/if}
          </div>
        </div>
      </footer>
    </main>
  </div>
</div>
