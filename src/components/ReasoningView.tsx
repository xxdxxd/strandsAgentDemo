import React, { useState } from 'react';
import { ReasoningStep } from '../types';
import { 
  Brain, 
  Terminal, 
  Database, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight, 
  Clock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReasoningViewProps {
  steps: ReasoningStep[];
}

export function ReasoningView({ steps }: ReasoningViewProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  if (!steps || steps.length === 0) return null;

  const toggleStep = (id: string) => {
    setExpandedSteps(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getStepIcon = (type: ReasoningStep['type']) => {
    switch (type) {
      case 'thought':
        return <Brain className="w-4 h-4 text-emerald-500" />;
      case 'tool_call':
        return <Terminal className="w-4 h-4 text-amber-500" />;
      case 'tool_response':
        return <Database className="w-4 h-4 text-indigo-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
    }
  };

  const getStepBg = (type: ReasoningStep['type']) => {
    switch (type) {
      case 'thought':
        return 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300';
      case 'tool_call':
        return 'bg-amber-50/60 dark:bg-amber-950/25 border-amber-100 dark:border-amber-900/40 text-amber-800 dark:text-amber-300';
      case 'tool_response':
        return 'bg-indigo-50/60 dark:bg-indigo-950/25 border-indigo-100 dark:border-indigo-900/40 text-indigo-800 dark:text-indigo-300';
      case 'error':
        return 'bg-rose-50/60 dark:bg-rose-955/25 border-rose-100 dark:border-rose-900/40 text-rose-800 dark:text-rose-300';
    }
  };

  return (
    <div className="my-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-slate-900/30 overflow-hidden shadow-xs">
      {/* Header Bar */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-100/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-xs font-semibold select-none"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-500 animate-pulse" />
          <span>Strands Agent Core Reasoning Trail ({steps.length} {steps.length === 1 ? 'Step' : 'Steps'})</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase font-mono bg-blue-100/60 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-sm">
            Agent Loop Active
          </span>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {/* Accordion Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-100 dark:border-slate-800"
          >
            <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">
              {steps.map((step, idx) => {
                const isStepExpanded = expandedSteps[step.id] ?? (step.type === 'tool_call' || step.type === 'error' || idx === steps.length - 2);
                
                return (
                  <div key={step.id} className="relative pl-6">
                    {/* Line Connector */}
                    {idx < steps.length - 1 && (
                      <div className="absolute left-2.5 top-6 bottom-0 w-0.5 bg-slate-250 dark:bg-slate-800" />
                    )}

                    {/* Step Bubble Icon */}
                    <div className="absolute left-0 top-1 p-0.5 rounded-full bg-white dark:bg-slate-950 shadow-xs border border-slate-150 dark:border-slate-850">
                      {getStepIcon(step.type)}
                    </div>

                    {/* Step Card */}
                    <div className={`border rounded-lg ${getStepBg(step.type)} shadow-2xs overflow-hidden transition-all duration-150`}>
                      <button
                        onClick={() => toggleStep(step.id)}
                        className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 bg-white/40 dark:bg-slate-900/20 active:bg-white/10"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-semibold text-xs truncate">{step.title}</span>
                          {step.toolName && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 roundedbg-slate-100 dark:bg-slate-800 uppercase tracking-wider font-bold">
                              {step.toolName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {step.elapsedMs !== undefined && (
                            <span className="text-[10px] font-mono opacity-80 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {step.elapsedMs}ms
                            </span>
                          )}
                          {isStepExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </div>
                      </button>

                      {isStepExpanded && (
                        <div className="p-3 pt-1 border-t border-slate-100/50 dark:border-slate-900/25 bg-white/10 text-xs">
                          {step.type === 'thought' ? (
                            <p className="whitespace-pre-wrap leading-relaxed opacity-95 font-sans break-words selection:bg-emerald-200/50">
                              {step.details}
                            </p>
                          ) : (
                            <pre className="whitespace-pre-wrap leading-relaxed font-mono text-[11px] break-all bg-slate-900/5 dark:bg-black/20 p-2 rounded-md overflow-x-auto text-slate-800 dark:text-slate-250 border border-slate-200/20 shadow-inner">
                              {step.details}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
