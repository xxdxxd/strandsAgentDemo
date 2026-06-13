import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  User, 
  Send, 
  Sparkles, 
  Calculator, 
  CloudSun, 
  Globe, 
  Settings, 
  Check, 
  Play, 
  RotateCcw, 
  HelpCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Sliders,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatSession, Message, ToolType, ToolDefinition, ReasoningStep, OpenAIConfig } from './types';
import { ReasoningView } from './components/ReasoningView';

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
          content: "Hello! I am a **Strands Agent**. I can run sequential, multi-step actions using the tools enabled on the left panel.\n\nType in questions requiring live data or computations, and you will be able to trace my thoughts and calculations in real-time!",
          timestamp: Date.now()
        }
      ]
    }
  ];
};

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => getInitialSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const initial = getInitialSessions();
    return initial[0].id;
  });
  const [inputMessage, setInputMessage] = useState<string>('');
  const [enabledTools, setEnabledTools] = useState<ToolType[]>(() => {
    const initial = getInitialSessions();
    const active = initial[0];
    return active?.enabledTools || ['calculator', 'weather'];
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // OpenRouter or OpenAI dynamic model & key credentials state configuration
  const [openAIApiKey, setOpenAIApiKey] = useState<string>(() => localStorage.getItem('strands_openai_key') || '');
  const [showApiKeyText, setShowApiKeyText] = useState<boolean>(false);
  const [openAIBaseURL, setOpenAIBaseURL] = useState<string>(() => {
    const saved = localStorage.getItem('strands_openai_base_url');
    if (saved && saved !== 'https://api.openai.com/v1') return saved;
    return 'https://openrouter.ai/api/v1';
  });
  const [openAIModel, setOpenAIModel] = useState<string>(() => {
    const saved = localStorage.getItem('strands_openai_model');
    if (saved && saved !== 'gpt-4o-mini') return saved;
    return 'openai/gpt-4o-mini';
  });
  
  // Real-time server connectivity health checker
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [hasServerEnvKey, setHasServerEnvKey] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync session changes back to localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('strands_agent_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  // Sync OpenAI client parameter selections
  useEffect(() => {
    localStorage.setItem('strands_openai_key', openAIApiKey);
  }, [openAIApiKey]);

  useEffect(() => {
    localStorage.setItem('strands_openai_base_url', openAIBaseURL);
  }, [openAIBaseURL]);

  useEffect(() => {
    localStorage.setItem('strands_openai_model', openAIModel);
  }, [openAIModel]);

  // Check server connection status
  useEffect(() => {
    const testHealth = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          setServerStatus('connected');
          setHasServerEnvKey(!!data.hasEnvKey);
        } else {
          setServerStatus('error');
        }
      } catch (err) {
        setServerStatus('error');
      }
    };
    testHealth();
  }, []);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading]);

  const toggleTool = (toolId: ToolType) => {
    const updated = enabledTools.includes(toolId)
      ? enabledTools.filter(t => t !== toolId)
      : [...enabledTools, toolId];
    
    setEnabledTools(updated);

    // Persist to current session object
    if (activeSession) {
      setSessions(prev => prev.map(s => {
        if (s.id === activeSession.id) {
          return { ...s, enabledTools: updated };
        }
        return s;
      }));
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const messageToSend = customPrompt || inputMessage;
    if (!messageToSend || messageToSend.trim() === '' || isLoading) return;

    if (!customPrompt) {
      setInputMessage('');
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
    setSessions(prev => prev.map(s => {
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
    }));

    setIsLoading(true);
    setErrorBanner(null);

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

      setSessions(prev => prev.map(s => {
        if (s.id === activeSession.id) {
          return {
            ...s,
            messages: [...s.messages, newModelMessage]
          };
        }
        return s;
      }));
    } catch (err: any) {
      console.error("Agent error:", err);
      setErrorBanner(err.message || "An issue occurred while running the agentic query cycle.");
    } finally {
      setIsLoading(false);
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
    setSessions(prev => [freshSession, ...prev]);
    setActiveSessionId(newId);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      // Clear current messages but keep database structured
      setSessions([{
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
      }]);
      setActiveSessionId('default-session-id');
      return;
    }

    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    if (activeSessionId === id) {
      setActiveSessionId(filtered[0].id);
    }
  };

  const renderToolIcon = (id: string) => {
    switch (id) {
      case 'calculator': return <Calculator className="w-4 h-4 text-emerald-500" />;
      case 'weather': return <CloudSun className="w-4 h-4 text-amber-500" />;
      default: return <Settings className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div id="app-container" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col">
      {/* Primary Top Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 shrink-0 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">Strands Agent</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Multi-turn tool-calling reasoning loop</p>
          </div>
        </div>

        {/* Server Indicator Status and Environment Tags */}
        <div className="flex items-center gap-2">
          {serverStatus === 'checking' && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Verifying link...
            </span>
          )}
          {serverStatus === 'connected' && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Node.js Orchestrator Online
            </span>
          )}
          {serverStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 rounded-full border border-rose-100 dark:border-rose-800">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Orchestrator Offline
            </span>
          )}
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side Sidebar - Tool Preferences & Suggested Presets */}
        <aside className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 hidden md:flex">
          {/* Section: Sessions Controls */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <button 
              onClick={createNewSession}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Bot className="w-4 h-4" />
              New Agent Session
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
            {/* Conversations list */}
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-1">
                Recent Chats
              </h3>
              <div className="space-y-1">
                {sessions.map(s => {
                  const isActive = s.id === activeSessionId;
                  return (
                    <div 
                      key={s.id}
                      onClick={() => {
                        setActiveSessionId(s.id);
                        if (s.enabledTools) setEnabledTools(s.enabledTools);
                      }}
                      className={`group w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isActive 
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium' 
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-450'
                      }`}
                    >
                      <span className="truncate flex-1">{s.title || "First Chat Conversation"}</span>
                      <button 
                        onClick={(e) => deleteSession(e, s.id)}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-0.5 rounded text-[10px]"
                        title="Delete conversation"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section: Active Service Tools Selection */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Enabled Tools
                </h3>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/40">
                  {enabledTools.length}/{AVAILABLE_TOOLS.length} Ready
                </span>
              </div>

              <div className="space-y-2">
                {AVAILABLE_TOOLS.map((tool) => {
                  const isEnabled = enabledTools.includes(tool.id);
                  return (
                    <button
                      key={tool.id}
                      onClick={() => toggleTool(tool.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex gap-3 ${
                        isEnabled
                          ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-2xs'
                          : 'bg-transparent border-dashed border-slate-200 dark:border-slate-800/60 text-slate-400 dark:text-slate-600'
                      }`}
                      id={`tool-btn-${tool.id}`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${
                        isEnabled ? 'bg-white dark:bg-slate-850 shadow-xs border border-slate-100 dark:border-slate-800' : 'bg-slate-100 dark:bg-slate-900'
                      }`}>
                        {renderToolIcon(tool.id)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs truncate">{tool.name}</span>
                          {isEnabled ? (
                            <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                          ) : (
                            <span className="text-[9px] font-medium tracking-wide text-slate-400 uppercase">Disabled</span>
                          )}
                        </div>
                        <p className="text-[11px] leading-snug mt-1 text-slate-500 dark:text-slate-400 font-normal">
                          {tool.description}
                        </p>
                        {isEnabled && (
                          <div className="mt-1 text-[9px] font-mono leading-none py-1 px-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 truncate">
                            {tool.parameterDescription}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400/85 dark:text-slate-500/85 mt-2.5 px-1 leading-normal">
                Select tools to dictate which capabilities are exposed for OpenAI to analyze.
              </p>
            </div>

            {/* Suggested test scenarios */}
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-1">
                Suggested Scenarios
              </h3>
              <div className="space-y-2">
                {SUGGESTED_PROMPTS.map((samp, idx) => (
                  <button
                    key={idx}
                    disabled={isLoading}
                    onClick={() => {
                      // Automatically enable the recommended tools for a spectacular demo!
                      setEnabledTools(samp.tools);
                      handleSendMessage(samp.text);
                    }}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-150 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 hover:bg-blue-50/30 hover:border-blue-200 dark:hover:bg-blue-950/25 dark:hover:border-blue-900/40 transition-all text-xs outline-none disabled:opacity-50"
                  >
                    <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 mb-1">
                      <ChevronRight className="w-3 h-3" />
                      <span>{samp.label}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed font-sans">{samp.text}</p>
                    <div className="flex gap-1.5 mt-1.5">
                      {samp.tools.map(t => (
                        <span key={t} className="text-[8px] font-semibold tracking-wider bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-450 px-1 rounded uppercase font-mono">
                          {t}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* OpenRouter & OpenAI Configuration preferences */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3.5">
              <div className="flex items-center gap-2 px-1 border-b border-transparent">
                <Sliders className="w-3.5 h-3.5 text-blue-650 dark:text-blue-400" />
                <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  OpenRouter Settings
                </h3>
              </div>

              <div className="space-y-2.5 px-1">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-semibold text-slate-505 dark:text-slate-400">
                      API Key (OpenRouter or OpenAI)
                    </label>
                    {openAIApiKey && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenAIApiKey('');
                          localStorage.removeItem('strands_openai_key');
                        }}
                        className="text-[9px] text-red-500 hover:text-red-600 dark:text-red-400 flex items-center gap-0.5 outline-none font-medium"
                        title="Clear API Key from Browser LocalStorage"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>Clear Saved Key</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showApiKeyText ? "text" : "password"}
                      value={openAIApiKey}
                      onChange={(e) => setOpenAIApiKey(e.target.value)}
                      placeholder={hasServerEnvKey ? "✔ Using server environment key" : "sk-or-... (Falls back to env settings)"}
                      className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-2 pr-8 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono text-slate-800 dark:text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKeyText(!showApiKeyText)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 outline-none"
                    >
                      {showApiKeyText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  
                  {/* Dynamic security and Git Leak prevention indicator */}
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/80 text-[10px] leading-relaxed space-y-1.5">
                    {hasServerEnvKey ? (
                      <div className="flex items-start gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Secure Key Detected:</span> A server-side environment key is currently active. You can safely leave this input completely blank.
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">No Host Key Detected:</span> Defaulting to client key provided above or system default sandbox.
                        </div>
                      </div>
                    )}
                    <div className="text-slate-500 dark:text-slate-400 border-t border-slate-150/40 dark:border-slate-800/40 pt-1.5 text-[9px]">
                      🔒 <span className="font-semibold text-slate-600 dark:text-slate-350">GitHub Leak Protection:</span> Your server-side settings reside in <code>.env</code> which is fully ignored in <code>.gitignore</code> (rules for <code>.env*</code> are pre-configured). Storing credentials on your host backend prevents secrets from ever reaching your GitHub commits.
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-505 dark:text-slate-400 mb-1">
                    Base URL (Endpoint)
                  </label>
                  <input
                    type="text"
                    value={openAIBaseURL}
                    onChange={(e) => setOpenAIBaseURL(e.target.value)}
                    placeholder="https://openrouter.ai/api/v1"
                    className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-505 dark:text-slate-400 mb-1">
                    Language Model Preset
                  </label>
                  <select
                    value={PRESET_MODELS.some(p => p.id === openAIModel) ? openAIModel : 'custom'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setOpenAIModel('openai/gpt-4-turbo');
                      } else {
                        setOpenAIModel(val);
                      }
                    }}
                    className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                  >
                    {PRESET_MODELS.map((preset) => (
                      <option key={preset.id} value={preset.id} className="bg-white dark:bg-slate-900">
                        {preset.label}
                      </option>
                    ))}
                    <option value="custom" className="bg-white dark:bg-slate-900">Custom Model ID...</option>
                  </select>
                </div>

                {(!PRESET_MODELS.some(p => p.id === openAIModel)) && (
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-505 dark:text-slate-400 mb-1">
                      Custom Model Identifier
                    </label>
                    <input
                      type="text"
                      value={openAIModel}
                      onChange={(e) => setOpenAIModel(e.target.value)}
                      placeholder="e.g. openai/gpt-4o"
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono text-slate-850 dark:text-slate-200"
                    />
                  </div>
                )}
              </div>
            </div>

          </div>
        </aside>

        {/* Center Canvas Area: Conversation Threads */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-55 dark:bg-slate-925">
          {/* Quick-toggle settings bar for mobile viewports */}
          <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex gap-2 overflow-x-auto">
            {AVAILABLE_TOOLS.map((tool) => {
              const isEnabled = enabledTools.includes(tool.id);
              return (
                <button
                  key={tool.id}
                  onClick={() => toggleTool(tool.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border shrink-0 flex items-center gap-1.5 transition-colors ${
                    isEnabled 
                      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold' 
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                  }`}
                >
                  {renderToolIcon(tool.id)}
                  <span>{tool.name.split(' ')[0]}</span>
                </button>
              );
            })}
            <button 
              onClick={createNewSession}
              className="text-xs px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-full font-semibold shrink-0 ml-auto"
            >
              + Chat
            </button>
          </div>

          {/* Top Info Banner if API keys are basic placeholders */}
          <div className="bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-850 px-6 py-2 flex items-center justify-between text-[11px] text-slate-400/80">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold uppercase bg-slate-200/65 dark:bg-slate-800 text-slate-600 px-1.5 py-0.5 rounded text-[9px]">SYSTEM</span>
              <span className="truncate">Strands framework ensures secure local sandbox environments.</span>
            </div>
            <span>v1.2.0</span>
          </div>

          {/* Chat Bubble timeline */}
          <div className="flex-grow overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
            {activeSession.messages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <div 
                  key={message.id} 
                  className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Persona Avatars */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center shadow-xs border border-blue-200/20 shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                  )}

                  <div className={`max-w-4xl min-w-[200px] ${isUser ? 'w-auto' : 'w-full'}`}>
                    <div className={`rounded-2xl p-4 md:p-5 shadow-sm border ${
                      isUser
                        ? 'bg-blue-600 dark:bg-blue-600 text-white border-blue-500/10 rounded-br-none ml-12'
                        : 'bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-850 rounded-bl-none mr-12'
                    }`}>
                      {/* Sub header info */}
                      <div className="flex items-center justify-between gap-4 mb-2 opacity-75 text-[10px]">
                        <span className="font-semibold flex items-center gap-1">
                          {isUser ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                          {isUser ? 'You' : 'Strands Agent'}
                        </span>
                        <span>
                          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Msg text */}
                      <div className="text-sm leading-relaxed whitespace-pre-wrap break-words font-sans selection:bg-blue-200 dark:selection:bg-blue-800">
                        {message.content}
                      </div>
                    </div>

                    {/* Associated Multi-turn core reasoning path */}
                    {!isUser && message.reasoningSteps && message.reasoningSteps.length > 0 && (
                      <ReasoningView steps={message.reasoningSteps} />
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-lg bg-emerald-150 dark:bg-emerald-900/35 text-emerald-800 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-250/15">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Simulated Live Processing thought cards */}
            {isLoading && (
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="w-full max-w-4xl space-y-3">
                  <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-2xl p-5 shadow-xs flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
                      Strands Agent is reasoning... executing multi-step tools if required.
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Screen Error Notification Banner */}
          {errorBanner && (
            <div className="mx-6 md:mx-8 mb-2 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5 shadow-sm">
              <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Execution Exception</span>
                <p className="opacity-95 leading-relaxed">{errorBanner}</p>
              </div>
              <button 
                onClick={() => setErrorBanner(null)}
                className="hover:bg-rose-100 dark:hover:bg-rose-900/60 p-1 px-2 rounded-md font-mono text-[10px]"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* User Input controls Form */}
          <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6 shrink-0 shadow-inner">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-3 max-w-4xl mx-auto items-end"
            >
              <div className="flex-grow relative">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isLoading}
                  placeholder={`Send instructions... (e.g., "What is ${new Date().getFullYear() - 1999} * 57.5?" or weather queries)`}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3 pr-10 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 disabled:opacity-60 resize-none font-sans custom-scrollbar"
                />
                
                {/* Visual Tool Quick Stats Indicators */}
                <div className="absolute right-3.5 bottom-3.5 flex items-center gap-1.5 opacity-60">
                  <HelpCircle 
                    className="w-4 h-4 text-slate-400 cursor-help" 
                    title="Press Enter to send. Shift+Enter for new line."
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {/* Reset dialogue controls */}
                <button
                  type="button"
                  title="Wipe active chat histories"
                  onClick={() => {
                    if (confirm("Are you sure you want to clear this entire conversation history?")) {
                      setSessions(prev => prev.map(s => {
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
                      }));
                    }
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-red-500 transition-colors bg-white dark:bg-slate-900 shadow-xs h-10 w-10 flex items-center justify-center cursor-pointer"
                >
                  <RotateCcw className="w-4.5 h-4.5" />
                </button>

                <button
                  type="submit"
                  disabled={isLoading || !inputMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-150 dark:disabled:bg-slate-850 disabled:text-slate-400 text-white rounded-xl p-2.5 transition-all text-sm font-semibold h-10 w-10 flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/10"
                >
                  {isLoading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Send className="w-4.5 h-4.5" />}
                </button>
              </div>
            </form>
            
            {/* Enabled tags label list footer */}
            <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-slate-400 dark:text-slate-500">
              <span className="font-semibold uppercase tracking-wider text-[9px]">Tools active in dialog:</span>
              <div className="flex gap-2">
                {enabledTools.length === 0 ? (
                  <span className="text-amber-500 font-semibold italic">No tools enabled (Standard LLM Response Only)</span>
                ) : (
                  enabledTools.map(t => (
                    <span key={t} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded text-slate-600 dark:text-slate-450 font-medium">
                      {renderToolIcon(t)}
                      <span className="capitalize">{t.replace('_', ' ')}</span>
                    </span>
                  ))
                )}
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
