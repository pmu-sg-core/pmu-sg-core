import { supabase } from './supabase';
import type { TaskFieldsState } from './agent-config';

// Check if sender is blacklisted
export async function isBlacklisted(phoneNumber: string): Promise<boolean> {
  const { data } = await supabase
    .from('governance_blacklist')
    .select('id')
    .eq('identity', phoneNumber)
    .single();
  return !!data;
}

// Log incoming message to intake_logs
export async function logIntake(params: {
  platformMessageId: string;
  senderId: string;
  messageBody: string;
  rawPayload: Record<string, unknown>;
}): Promise<string | null> {
  const { data } = await supabase
    .from('intake_logs')
    .insert({
      platform_message_id: params.platformMessageId,
      sender_id: params.senderId,
      message_body: params.messageBody,
      raw_payload: params.rawPayload,
    })
    .select('id')
    .single();
  return data?.id ?? null;
}

// Log outgoing reply to communication_logs
export async function logCommunication(params: {
  intakeLogId: string;
  platform: string;
  platformMessageId: string;
  senderId: string;
  messageBody: string;
  rawPayload: Record<string, unknown>;
}): Promise<string | null> {
  const { data } = await supabase
    .from('communication_logs')
    .insert({
      intake_log_id: params.intakeLogId,
      platform: params.platform,
      platform_message_id: params.platformMessageId,
      sender_id: params.senderId,
      message_body: params.messageBody,
      raw_payload: params.rawPayload,
    })
    .select('id')
    .single();
  return data?.id ?? null;
}

// Get subscriber email linked to a subscription (for Jira permission checks)
export async function getSubscriberEmail(senderId: string, channel: 'whatsapp' | 'teams'): Promise<string | null> {
  const column = channel === 'teams' ? 'teams_user_id' : 'whatsapp_number';
  const { data } = await supabase
    .from('subscriptions')
    .select('subscriber:subscriber_id (email)')
    .eq(column, senderId)
    .single();
  return (data?.subscriber as { email?: string } | null)?.email ?? null;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

// Fetch conversation history, gathering state, and partial task fields (active record only)
export async function getConversationState(senderId: string, channel: string): Promise<{
  history: ConversationTurn[];
  gatheringTask: boolean;
  taskFields: TaskFieldsState;
}> {
  const { data } = await supabase
    .from('active_conversations')
    .select('conversation_history, gathering_task, task_fields')
    .eq('sender_id', senderId)
    .eq('channel', channel)
    .eq('is_active', true)
    .single();
  return {
    history: (data?.conversation_history as ConversationTurn[]) ?? [],
    gatheringTask: data?.gathering_task ?? false,
    taskFields: (data?.task_fields as TaskFieldsState) ?? {},
  };
}

// Update conversation history, gathering state, and partial task fields on the active record.
// Uses UPDATE first (matches partial unique index WHERE is_active=true), falls back to INSERT
// for first-time senders. Supabase upsert cannot express partial index ON CONFLICT clauses.
export async function updateConversationState(
  senderId: string,
  channel: string,
  history: ConversationTurn[],
  gatheringTask: boolean,
  taskFields: TaskFieldsState,
  pmIssueKey?: string,
): Promise<void> {
  const MAX_HISTORY = 20;
  const trimmed = history.slice(-MAX_HISTORY);
  const payload = {
    conversation_history: trimmed,
    gathering_task: gatheringTask,
    task_fields: gatheringTask ? taskFields : {},
    last_interaction_at: new Date().toISOString(),
    ...(pmIssueKey ? { last_pm_issue_key: pmIssueKey } : {}),
  };

  const { count } = await supabase
    .from('active_conversations')
    .update(payload, { count: 'exact' })
    .eq('sender_id', senderId)
    .eq('channel', channel)
    .eq('is_active', true);

  if (!count) {
    await supabase
      .from('active_conversations')
      .insert({ sender_id: senderId, channel, is_active: true, ...payload });
  }
}

// Retire the current active conversation and open a fresh one for an unrelated message.
// The old record is marked inactive; retention rules handle eventual cleanup.
export async function rotateConversationState(
  senderId: string,
  channel: string,
  firstTurns: ConversationTurn[],
): Promise<void> {
  await supabase
    .from('active_conversations')
    .update({ is_active: false, last_interaction_at: new Date().toISOString() })
    .eq('sender_id', senderId)
    .eq('channel', channel)
    .eq('is_active', true);

  await supabase
    .from('active_conversations')
    .insert({
      sender_id: senderId,
      channel,
      is_active: true,
      conversation_history: firstTurns,
      gathering_task: false,
      task_fields: {},
      last_interaction_at: new Date().toISOString(),
    });
}

// Log AI interaction to ai_audit_trail
export async function logAuditTrail(params: {
  commLogId: string | null;
  inputText: string;
  aiSummaryTitle: string;
  aiClassification: string;
  confidenceScore: number;
  processingTimeMs: number;
}): Promise<void> {
  await supabase.from('ai_audit_trail').insert({
    comm_log_id: params.commLogId,
    input_text: params.inputText,
    ai_summary_title: params.aiSummaryTitle,
    ai_classification: params.aiClassification,
    confidence_score: params.confidenceScore,
    processing_time_ms: params.processingTimeMs,
  });
}
