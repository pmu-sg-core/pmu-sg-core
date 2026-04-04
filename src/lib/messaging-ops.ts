import { supabase } from './supabase';

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

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

// Fetch conversation history and gathering state for a sender
export async function getConversationState(senderId: string, channel: string): Promise<{
  history: ConversationTurn[];
  gatheringTask: boolean;
}> {
  const { data } = await supabase
    .from('active_conversations')
    .select('conversation_history, gathering_task')
    .eq('sender_id', senderId)
    .eq('channel', channel)
    .single();
  return {
    history: (data?.conversation_history as ConversationTurn[]) ?? [],
    gatheringTask: data?.gathering_task ?? false,
  };
}

// Upsert conversation history and gathering state
export async function updateConversationState(
  senderId: string,
  channel: string,
  history: ConversationTurn[],
  gatheringTask: boolean,
  pmIssueKey?: string,
): Promise<void> {
  const MAX_HISTORY = 20; // keep last 20 turns
  const trimmed = history.slice(-MAX_HISTORY);
  await supabase
    .from('active_conversations')
    .upsert({
      sender_id: senderId,
      channel,
      conversation_history: trimmed,
      gathering_task: gatheringTask,
      last_interaction_at: new Date().toISOString(),
      ...(pmIssueKey ? { last_pm_issue_key: pmIssueKey } : {}),
    }, { onConflict: 'sender_id,channel' });
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
