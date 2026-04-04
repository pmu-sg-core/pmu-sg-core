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

export async function getAgentGovernance(
  identity: string,
  channel: 'whatsapp' | 'teams' = 'whatsapp'
): Promise<AgentGovernance | null> {
  const column = channel === 'teams' ? 'teams_user_id' : 'whatsapp_number';

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
    .eq(column, identity)
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
  "classification": "<one of: general_inquiry, pm.task_request, pm.task_incomplete, status_update, complaint, out_of_scope>",
  "confidence": <a number between 0.0 and 1.0 indicating how confident you are in your reply>
}
Do not include any text outside the JSON object.

Classification rules for task routing:
- Use "pm.task_request" ONLY when the message clearly contains: (1) a specific task or action to be done, (2) enough context to act on it without further clarification, and (3) an implicit or explicit owner or requester.
- Use "pm.task_incomplete" when the message signals a task intent but is missing critical detail — e.g. vague requests like "can you create a task", "help me with something", or "I need to raise a ticket". In this case, your reply must ask the user to provide: Task title (what needs to be done), Description (details and context), and Priority (Low, Medium, High, or Critical).
- Never create a Jira ticket for ambiguous or incomplete task requests.`;

  if (provider === 'anthropic') {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: structuredSystem,
      messages: [{ role: 'user', content: text }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return {
        reply: parsed.reply ?? "I'm sorry, I couldn't process that.",
        classification: parsed.classification ?? 'general_inquiry',
        confidence: parsed.confidence ?? 0.5,
      };
    } catch {
      return { reply: cleaned, classification: 'general_inquiry', confidence: 0.5 };
    }
  }

  // Future providers: else if (provider === 'openai') { ... }
  // Future providers: else if (provider === 'gemini') { ... }
  // Future providers: else if (provider === 'ollama') { ... }
  return { reply: 'Unsupported AI provider.', classification: 'out_of_scope', confidence: 1.0 };
}
