import { supabase } from './supabase';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentGovernance {
  // Plan
  plan_type: string;
  // Resource Limits
  max_input_chars: number;
  max_output_tokens: number;
  // AI Intelligence
  model_provider: string;
  model_name: string;
  // Personality
  temperature: number;
  system_prompt: string;
  prompt_id: string;
  // Capabilities
  can_access_kb: boolean;
  enable_history: boolean;
}

export async function getAgentGovernance(phoneNumber: string): Promise<AgentGovernance | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      plan_type,
      plan_tiers!inner (
        config_settings (
          max_input_chars,
          max_output_tokens,
          model_provider,
          model_name,
          temperature,
          system_prompt,
          prompt_id,
          can_access_kb,
          enable_history
        )
      )
    `)
    .eq('whatsapp_number', phoneNumber)
    .single();

  if (error || !data) return null;

  const tiers = (data as any).plan_tiers;
  const settings = Array.isArray(tiers) ? tiers[0]?.config_settings : tiers?.config_settings;
  const config = Array.isArray(settings) ? settings[0] : settings;

  if (!config) return null;

  return { ...config, plan_type: (data as any).plan_type };
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface LLMResult {
  reply: string;
  classification: string;
  confidence: number;
}

export async function callLLM({
  provider,
  model,
  text,
  maxTokens,
  temperature,
  systemPrompt,
}: {
  provider: string;
  model: string;
  text: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}): Promise<LLMResult> {
  const structuredSystem = `${systemPrompt}

IMPORTANT: Always respond with a valid JSON object in this exact format:
{
  "reply": "<your plain text response to the user>",
  "classification": "<one of: general_inquiry, task_request, status_update, complaint, out_of_scope>",
  "confidence": <a number between 0.0 and 1.0 indicating how confident you are in your reply>
}
Do not include any text outside the JSON object.`;

  if (provider === 'anthropic') {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: structuredSystem,
      messages: [{ role: 'user', content: text }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    try {
      const parsed = JSON.parse(raw);
      return {
        reply: parsed.reply ?? "I'm sorry, I couldn't process that.",
        classification: parsed.classification ?? 'general_inquiry',
        confidence: parsed.confidence ?? 0.5,
      };
    } catch {
      return { reply: raw, classification: 'general_inquiry', confidence: 0.5 };
    }
  }

  // Future providers: else if (provider === 'openai') { ... }
  // Future providers: else if (provider === 'gemini') { ... }
  // Future providers: else if (provider === 'ollama') { ... }
  return { reply: 'Unsupported AI provider.', classification: 'out_of_scope', confidence: 1.0 };
}
