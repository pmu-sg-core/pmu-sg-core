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
  can_assign_tickets: boolean;
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

export interface TaskFields {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assigneeEmail?: string; // only set when requestor has assign permission
}

export interface LLMResult {
  reply: string;
  classification: string;
  confidence: number;
  task?: TaskFields;
}

export async function callLLM({
  provider,
  model,
  text,
  maxTokens,
  temperature,
  systemPrompt,
  conversationHistory = [],
  canAssignTickets = false,
}: {
  provider: string;
  model: string;
  text: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  canAssignTickets?: boolean;
}): Promise<LLMResult> {
  const taskSchema = canAssignTickets
    ? `{ "title": "...", "description": "...", "priority": "Low|Medium|High|Critical", "assigneeEmail": "email@example.com or null" }`
    : `{ "title": "...", "description": "...", "priority": "Low|Medium|High|Critical" }`;

  const assigneeRule = canAssignTickets
    ? `- The requestor has permission to assign tickets. After collecting title, description, and priority, ask: "Who should this be assigned to? Please provide their email address, or say 'unassigned'." Include their answer as "assigneeEmail" in the task field (null if unassigned).`
    : `- The requestor does not have permission to assign tickets. Do not ask about assignees. The ticket will be created unassigned for the team to triage.`;

  const structuredSystem = `${systemPrompt}

IMPORTANT: Always respond with a valid JSON object in this exact format:
{
  "reply": "<your plain text response to the user>",
  "classification": "<one of: general_inquiry, pm.task_request, pm.task_incomplete, status_update, complaint, out_of_scope>",
  "confidence": <a number between 0.0 and 1.0 indicating how confident you are in your reply>,
  "task": ${taskSchema}
}
The "task" field is REQUIRED when classification is "pm.task_request". Omit it for all other classifications.
Do not include any text outside the JSON object.

Classification rules for task routing:
- Use "pm.task_request" ONLY when you have collected ALL required fields (see assignee rule below). Populate the "task" field with the collected values.
- Use "pm.task_incomplete" when the user signals task intent but any required field is still missing. Ask ONLY for the next missing field — one question at a time, in this exact order: title → description → priority${canAssignTickets ? ' → assignee email' : ''}. Do NOT ask for due date, deadline, effort, or any other field.
- Never classify as "pm.task_request" if any required task field is still unknown.
- Never create a ticket for vague, ambiguous, or incomplete task requests.
${assigneeRule}`;

  if (provider === 'anthropic') {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...conversationHistory,
      { role: 'user', content: text },
    ];

    const msg = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: structuredSystem,
      messages,
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return {
        reply: parsed.reply ?? "I'm sorry, I couldn't process that.",
        classification: parsed.classification ?? 'general_inquiry',
        confidence: parsed.confidence ?? 0.5,
        task: parsed.task,
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
