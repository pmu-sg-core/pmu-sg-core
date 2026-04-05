// Intent queue types — core orchestration data model.
// Imported by messaging-ops (DB layer) and react-loop/index.ts (orchestration).

import type { TaskFieldsState } from '@/adapters/pmtool/types';

export type IntentType =
  | 'pm.task_create'
  | 'pm.task_query'
  | 'pm.task_assign'
  | 'general_inquiry'
  | 'status_update'
  | 'complaint'
  | 'out_of_scope';

export type IntentStatus =
  | 'gathering'    // actively collecting fields from user
  | 'ready'        // all fields collected, awaiting execution
  | 'executing'    // react-loop is processing
  | 'complete'     // finished successfully
  | 'failed';      // terminal error

export interface IntentResult {
  issueKey?: string;                   // pm.task_create outcome
  message?: string;                    // human-readable summary
  data?: Record<string, unknown>;      // arbitrary structured result
}

export interface PendingIntent {
  id: string;                  // uuid — stable across turns
  type: IntentType;
  status: IntentStatus;
  fields: TaskFieldsState;     // gathered field state for this intent
  result?: IntentResult;       // populated after execution
  createdAt: string;           // ISO timestamp
  completedAt?: string;        // ISO timestamp — set when status → complete | failed
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the currently active intent from the queue, or null if queue is empty. */
export function getActiveIntent(
  pendingIntents: PendingIntent[],
  activeIntentIdx: number,
): PendingIntent | null {
  return pendingIntents[activeIntentIdx] ?? null;
}

/** Derive legacy gatheringTask + taskFields from the intent queue.
 *  Keeps route handlers unchanged while the queue model is adopted. */
export function deriveGatheringState(
  pendingIntents: PendingIntent[],
  activeIntentIdx: number,
): { gatheringTask: boolean; taskFields: TaskFieldsState } {
  const active = getActiveIntent(pendingIntents, activeIntentIdx);
  return {
    gatheringTask: active?.status === 'gathering',
    taskFields: active?.fields ?? {},
  };
}

/** Create a new gathering intent and append to queue. */
export function createIntent(type: IntentType): PendingIntent {
  return {
    id: crypto.randomUUID(),
    type,
    status: 'gathering',
    fields: {},
    createdAt: new Date().toISOString(),
  };
}
