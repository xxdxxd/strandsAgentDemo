<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { ReasoningStep } from '$lib/types';
  import { 
    Brain, 
    Terminal, 
    Database, 
    AlertTriangle, 
    ChevronDown, 
    ChevronRight, 
    Clock 
  } from 'lucide-svelte';

  interface Props {
    steps: ReasoningStep[];
  }

  let { steps }: Props = $props();

  let isOpen = $state(true);
  let expandedSteps = $state<Record<string, boolean>>({});

  const toggleStep = (id: string) => {
    expandedSteps[id] = !expandedSteps[id];
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
</script>

{#if steps && steps.length > 0}
  <div class="my-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-slate-900/30 overflow-hidden shadow-xs">
    <!-- Header Bar -->
    <button 
      onclick={() => isOpen = !isOpen}
      class="w-full flex items-center justify-between px-4 py-3 bg-slate-100/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-xs font-semibold select-none cursor-pointer"
    >
      <div class="flex items-center gap-2">
        <Terminal class="w-4 h-4 text-blue-500 animate-pulse" />
        <span>Strands Agent Core Reasoning Trail ({steps.length} {steps.length === 1 ? 'Step' : 'Steps'})</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-[10px] uppercase font-mono bg-blue-100/60 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-sm">
          Agent Loop Active
        </span>
        {#if isOpen}
          <ChevronDown class="w-4 h-4" />
        {:else}
          <ChevronRight class="w-4 h-4" />
        {/if}
      </div>
    </button>

    <!-- Accordion Content -->
    {#if isOpen}
      <div transition:slide={{ duration: 200 }} class="overflow-hidden border-t border-slate-100 dark:border-slate-800">
        <div class="p-3 space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">
          {#each steps as step, idx (step.id)}
            {@const isStepExpanded = expandedSteps[step.id] ?? (step.type === 'tool_call' || step.type === 'error' || idx === steps.length - 2)}
            <div class="relative pl-6">
              <!-- Line Connector -->
              {#if idx < steps.length - 1}
                <div class="absolute left-2.5 top-6 bottom-0 w-0.5 bg-slate-250 dark:bg-slate-800"></div>
              {/if}

              <!-- Step Bubble Icon -->
              <div class="absolute left-0 top-1 p-0.5 rounded-full bg-white dark:bg-slate-950 shadow-xs border border-slate-150 dark:border-slate-850">
                {#if step.type === 'thought'}
                  <Brain class="w-4 h-4 text-emerald-500" />
                {:else if step.type === 'tool_call'}
                  <Terminal class="w-4 h-4 text-amber-500" />
                {:else if step.type === 'tool_response'}
                  <Database class="w-4 h-4 text-indigo-500" />
                {:else if step.type === 'error'}
                  <AlertTriangle class="w-4 h-4 text-rose-500" />
                {/if}
              </div>

              <!-- Step Card -->
              <div class="border rounded-lg {getStepBg(step.type)} shadow-2xs overflow-hidden transition-all duration-150">
                <button
                  onclick={() => toggleStep(step.id)}
                  class="w-full text-left px-3 py-2 flex items-center justify-between gap-2 bg-white/40 dark:bg-slate-900/20 active:bg-white/10 cursor-pointer"
                >
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="font-semibold text-xs truncate">{step.title}</span>
                    {#if step.toolName}
                      <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-850 uppercase tracking-wider font-bold">
                        {step.toolName}
                      </span>
                    {/if}
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    {#if step.elapsedMs !== undefined}
                      <span class="text-[10px] font-mono opacity-80 flex items-center gap-1">
                        <Clock class="w-3 h-3" />
                        {step.elapsedMs}ms
                      </span>
                    {:else if isStepExpanded}
                      <ChevronDown class="w-3.5 h-3.5" />
                    {:else}
                      <ChevronRight class="w-3.5 h-3.5" />
                    {/if}
                  </div>
                </button>

                {#if isStepExpanded}
                  <div transition:slide={{ duration: 150 }} class="p-3 pt-1 border-t border-slate-100/50 dark:border-slate-900/25 bg-white/10 text-xs">
                    {#if step.type === 'thought'}
                      <p class="whitespace-pre-wrap leading-relaxed opacity-95 font-sans break-words selection:bg-emerald-200/50">
                        {step.details}
                      </p>
                    {:else}
                      <pre class="whitespace-pre-wrap leading-relaxed font-mono text-[11px] break-all bg-slate-900/5 dark:bg-black/20 p-2 rounded-md overflow-x-auto text-slate-800 dark:text-slate-250 border border-slate-200/20 shadow-inner">{step.details}</pre>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
