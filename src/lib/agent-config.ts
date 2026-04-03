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
}): Promise<string> {
  if (provider === 'anthropic') {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
    });
    return msg.content[0].type === 'text' ? msg.content[0].text : "I'm sorry, I couldn't process that.";
  }

  // Future providers: else if (provider === 'openai') { ... }
  // Future providers: else if (provider === 'gemini') { ... }
  // Future providers: else if (provider === 'ollama') { ... }
  return "Unsupported AI provider.";
}
