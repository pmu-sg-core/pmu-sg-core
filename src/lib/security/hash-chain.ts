import { createHash } from 'crypto';
import { supabase } from '../supabase';

export function computeHash(data: string, previousHash: string | null): string {
  return createHash('sha256')
    .update(`${previousHash ?? '0'}:${data}`)
    .digest('hex');
}

export async function getLatestHash(): Promise<string | null> {
  const { data } = await supabase
    .from('audit_vault')
    .select('hash_signature')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data?.hash_signature ?? null;
}

export async function writeAuditVault(params: {
  actorBsuid: string;
  reasoningTrace: Record<string, unknown>;
  actionTaken: string;
  modelVersion: string;
  promptId: string;
}): Promise<void> {
  const previousHash = await getLatestHash();

  const traceString = JSON.stringify({
    ...params.reasoningTrace,
    model_version: params.modelVersion,
    prompt_id: params.promptId,
  });

  const hashSignature = computeHash(traceString, previousHash);

  await supabase.from('audit_vault').insert({
    hash_signature: hashSignature,
    previous_hash: previousHash,
    actor_bsuid: params.actorBsuid,
    reasoning_trace: params.reasoningTrace,
    action_taken: params.actionTaken,
    model_version: params.modelVersion,
  });
}
