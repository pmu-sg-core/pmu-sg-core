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
      status: 'received',
      raw_payload: params.rawPayload,
    })
    .select('id')
    .single();
  return data?.id ?? null;
}

// Log outgoing reply to communication_logs
export async function logCommunication(params: {
  platformMessageId: string;
  senderId: string;
  messageBody: string;
  rawPayload: Record<string, unknown>;
}): Promise<string | null> {
  const { data } = await supabase
    .from('communication_logs')
    .insert({
      platform: 'whatsapp',
      platform_message_id: params.platformMessageId,
      sender_id: params.senderId,
      message_body: params.messageBody,
      raw_payload: params.rawPayload,
    })
    .select('id')
    .single();
  return data?.id ?? null;
}

// Log AI interaction to ai_audit_trail
export async function logAuditTrail(params: {
  intakeLogId: string | null;
  commLogId: string | null;
  inputText: string;
  aiSummaryTitle: string;
  aiClassification: string;
  confidenceScore: number;
  processingTimeMs: number;
}): Promise<void> {
  await supabase.from('ai_audit_trail').insert({
    whatsapp_log_id: params.intakeLogId,
    comm_log_id: params.commLogId,
    input_text: params.inputText,
    ai_summary_title: params.aiSummaryTitle,
    ai_classification: params.aiClassification,
    confidence_score: params.confidenceScore,
    processing_time_ms: params.processingTimeMs,
  });
}
