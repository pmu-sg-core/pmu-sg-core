// Re-export barrel — keeps existing consumers (route files, messaging-ops) unchanged.
// Internals have been split into focused modules:
//   governance.ts    — Supabase governance lookup
//   orchestration.ts — callLLM / callLLMGathering
//   ../adapters/pmtool/types.ts — TaskFieldsState, getNextField, TaskFields

export { getAgentGovernance } from './governance';
export type { AgentGovernance } from './governance';

export { callLLM, callLLMGathering } from './orchestration';
export type { LLMResult, GatheringResult } from './orchestration';

export { getNextField } from '@/adapters/pmtool/types';
export type { TaskFieldsState, TaskFields } from '@/adapters/pmtool/types';
