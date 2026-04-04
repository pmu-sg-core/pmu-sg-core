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

// ── Task field types ──────────────────────────────────────────────────────────

export interface TaskFieldsState {
  title?: string;
  description?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  assigneeEmail?: string;
}

const FIELD_ORDER: (keyof TaskFieldsState)[] = ['title', 'description', 'priority', 'assigneeEmail'];

const FIELD_LABELS: Record<keyof TaskFieldsState, string> = {
  title: 'title (a short label for the task)',
  description: 'description (what needs to be done and why)',
  priority: 'priority — reply with one of: Low, Medium, High, Critical',
  assigneeEmail: 'assignee email address (or say "unassigned")',
};

export function getNextField(
  fields: TaskFieldsState,
  canAssignTickets: boolean,
): keyof TaskFieldsState | null {
  const active = canAssignTickets ? FIELD_ORDER : FIELD_ORDER.slice(0, 3);
  return active.find(f => !fields[f]) ?? null;
}

// ── Normal-mode LLM (intent classification) ──────────────────────────────────

export interface TaskFields {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assigneeEmail?: string;
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

  const structuredSystem = `${systemPrompt}

IMPORTANT: Always respond with a valid JSON object in this exact format:
{
  "reply": "<your plain text response to the user>",
  "classification": "<one of: general_inquiry, pm.task_request, pm.task_incomplete, status_update, complaint, out_of_scope>",
  "confidence": <a number between 0.0 and 1.0>,
  "task": ${taskSchema}
}
The "task" field is REQUIRED when classification is "pm.task_request". Omit it for all other classifications.
Do not include any text outside the JSON object.

Classification rules:
- Use "pm.task_incomplete" when the user signals task intent. Ask only for the title first.
- Use "pm.task_request" ONLY when you have collected ALL required fields in one shot from the user's message. Populate the "task" field.
- Use "general_inquiry", "status_update", "complaint", or "out_of_scope" for everything else.`;

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

  return { reply: 'Unsupported AI provider.', classification: 'out_of_scope', confidence: 1.0 };
}

// ── Gathering-mode LLM (focused field extraction) ────────────────────────────

export interface GatheringResult {
  reply: string;
  classification: 'continuing' | 'ambiguous' | 'off_topic';
  extracted?: Partial<TaskFieldsState>;
}

export async function callLLMGathering({
  provider,
  model,
  text,
  maxTokens,
  temperature,
  systemPrompt,
  conversationHistory = [],
  taskFields,
  nextField,
  canAssignTickets,
  platform,
}: {
  provider: string;
  model: string;
  text: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  taskFields: TaskFieldsState;
  nextField: keyof TaskFieldsState;
  canAssignTickets: boolean;
  platform: 'WhatsApp' | 'Microsoft Teams';
}): Promise<GatheringResult> {
  // Build a readable snapshot of what's been collected so far
  const active = canAssignTickets ? FIELD_ORDER : FIELD_ORDER.slice(0, 3);
  const stateLines = active.map(f =>
    `  ${f}: ${taskFields[f] ? `"${taskFields[f]}"` : '(not yet collected)'}`
  ).join('\n');

  // What to ask for after this field (if anything)
  const hypothetical = { ...taskFields, [nextField]: 'filled' };
  const nextNextField = getNextField(hypothetical, canAssignTickets);
  const afterExtraction = nextNextField
    ? `Then ask for the next missing field: ${FIELD_LABELS[nextNextField]}.`
    : `All required fields will then be complete — reply with a brief confirmation that you have everything and will create the ticket now. Do not mention a ticket number yet.`;

  // The last assistant message, for grounding short replies
  const lastAssistantMsg = conversationHistory.filter(t => t.role === 'assistant').at(-1)?.content ?? '(none)';

  const gatheringSystem = `${systemPrompt}

You are collecting task details one field at a time. Current state:
${stateLines}

Your last message to the requestor was:
"${lastAssistantMsg}"

The requestor just replied:
"${text}"

Decide:
(a) "continuing" — their reply is a plausible answer to your last question, even if short (e.g. "Critical", "High", "John", "yes").
(b) "ambiguous" — you genuinely cannot tell if they are answering your question or starting something new entirely.
(c) "off_topic" — their reply has no plausible connection to the task or your last question.

Rules:
- Default to "continuing" whenever the reply could reasonably be an answer to what you just asked.
- Use "ambiguous" only when the reply is equally plausible as a new request and as an answer.
- Use "off_topic" only when the reply clearly has nothing to do with the task.
- If "continuing": extract the value for "${nextField}" exactly as the requestor stated it. ${afterExtraction}
- If "ambiguous": ask "Just to confirm — are you still working on the task we were discussing, or is this something new?"
- If "off_topic": acknowledge briefly that the task is being set aside.
- Always respond in plain text only — no markdown. This is ${platform}.

Respond with this JSON and nothing else:
{
  "reply": "<your plain text response>",
  "classification": "continuing" | "ambiguous" | "off_topic",
  "extracted": { "${nextField}": "<value>" }
}
Omit "extracted" when classification is not "continuing".`;

  if (provider === 'anthropic') {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: gatheringSystem,
      messages: [{ role: 'user', content: text }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return {
        reply: parsed.reply ?? "Got it.",
        classification: parsed.classification ?? 'continuing',
        extracted: parsed.extracted,
      };
    } catch {
      // If parsing fails, treat as continuing with raw text as the field value
      return { reply: "Got it.", classification: 'continuing', extracted: { [nextField]: text } as Partial<TaskFieldsState> };
    }
  }

  return { reply: 'Unsupported AI provider.', classification: 'off_topic' };
}
