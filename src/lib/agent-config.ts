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

// ── Prompt envelope helpers ───────────────────────────────────────────────────

/** <session_state> — explicit field snapshot + transition reasoning (the "delta").
 *  Prevents the model from re-deriving state from history or looping on answered fields. */
function buildSessionState(
  taskFields: TaskFieldsState,
  nextField: keyof TaskFieldsState,
  canAssignTickets: boolean,
): string {
  const active = canAssignTickets ? FIELD_ORDER : FIELD_ORDER.slice(0, 3);
  const dataStore = active.map(f => {
    const val = taskFields[f];
    return val
      ? `    <field status="complete" id="${f}">${val}</field>`
      : `    <field status="pending"  id="${f}">null</field>`;
  }).join('\n');

  const completed = active.filter(f => taskFields[f]);
  const reasoning = completed.length === 0
    ? 'Task collection started; requesting title.'
    : `User provided ${completed.at(-1)}; requesting ${nextField}.`;

  return `<session_state>
  <flow_position>gathering_requirements</flow_position>
  <data_store>
${dataStore}
  </data_store>
  <reasoning>${reasoning}</reasoning>
</session_state>`;
}

/** <interaction_anchor> — grounds short/terse replies against what was just asked.
 *  The intent_hint tells the model how to interpret the inbound message. */
function buildInteractionAnchor(
  lastOutbound: string | null,
  userInbound: string,
  intentHint: string,
): string {
  if (!lastOutbound) return '';
  return `<interaction_anchor>
  <last_outbound>${lastOutbound}</last_outbound>
  <user_inbound>${userInbound}</user_inbound>
  <intent_hint>${intentHint}</intent_hint>
</interaction_anchor>`;
}

/** Derive intent hint for normal-mode callLLM from the last assistant message. */
function normalModeIntentHint(lastOutbound: string | null): string {
  if (!lastOutbound) return 'Opening message in new conversation.';
  if (lastOutbound.trimEnd().endsWith('?')) return 'Direct answer or response to the previous question.';
  if (/\b(confirm|shall I|go ahead|update|creat|rais)\b/i.test(lastOutbound)) return 'Confirmation of a proposed action.';
  return 'Follow-up reply in ongoing conversation.';
}

/** <operational_contract> — hard capability boundary + failure protocol.
 *  Prevents capability hallucination and defines the pivot on out-of-scope requests. */
function buildOperationalContract(capabilities: string, constraints: string, onOutOfScope: string): string {
  return `<operational_contract>
  <capabilities>
${capabilities}
  </capabilities>
  <constraints>
${constraints}
  </constraints>
  <exception_handling>
    <on_out_of_scope>${onOutOfScope}</on_out_of_scope>
  </exception_handling>
</operational_contract>`;
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

  const lastOutbound = conversationHistory.filter(t => t.role === 'assistant').at(-1)?.content ?? null;

  const structuredSystem = `${systemPrompt}

${buildInteractionAnchor(lastOutbound, text, normalModeIntentHint(lastOutbound))}

${buildOperationalContract(
    `    - Create new tasks by collecting: title, description, priority${canAssignTickets ? ', assignee email' : ''}.
    - Answer general questions about pmu.sg and its features.`,
    `    - Cannot set due dates, update existing tickets, look up rosters, or list available assignees.
    - Cannot collect fields outside the defined set.`,
    `Politely decline and explain what Miyu can do: "I can help create tasks and answer general questions about pmu.sg. I'm not able to [action requested]."`
  )}

<classification_rules>
- Use "pm.task_incomplete" when the user signals task intent. Ask only for the title first.
- Use "pm.task_request" ONLY when you have ALL required fields in one shot. Populate the "task" field.
- Use "out_of_scope" for anything listed in the operational_contract constraints. Apply the on_out_of_scope protocol.
- If last_outbound was a confirmation and the user replied "yes", "ok", "sure", or similar, treat it as confirmed — do not ask for clarification.
- Use "general_inquiry", "status_update", or "complaint" for everything else.
</classification_rules>

<output_format>
Always respond with a valid JSON object in this exact format:
{
  "reply": "<your plain text response to the user>",
  "classification": "<one of: general_inquiry, pm.task_request, pm.task_incomplete, status_update, complaint, out_of_scope>",
  "confidence": <a number between 0.0 and 1.0>,
  "task": ${taskSchema}
}
The "task" field is REQUIRED when classification is "pm.task_request". Omit it for all other classifications.
Do not include any text outside the JSON object.
</output_format>`;

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
  // What to ask for after this field (if anything)
  const hypothetical = { ...taskFields, [nextField]: 'filled' };
  const nextNextField = getNextField(hypothetical, canAssignTickets);
  const afterExtraction = nextNextField
    ? `Then ask for the next missing field: ${FIELD_LABELS[nextNextField]}.`
    : `All required fields will then be complete — reply with a brief confirmation that you have everything and will create the ticket now. Do not mention a ticket number yet.`;

  const lastOutbound = conversationHistory.filter(t => t.role === 'assistant').at(-1)?.content ?? '(none)';

  const gatheringSystem = `${systemPrompt}

${buildSessionState(taskFields, nextField, canAssignTickets)}

${buildInteractionAnchor(lastOutbound, text, `Direct answer to field request: ${nextField}`)}

${buildOperationalContract(
    `    - Collect task fields in order: title, description, priority${canAssignTickets ? ', assignee email' : ''}.`,
    `    - Cannot set due dates, update tickets, look up rosters, or collect fields outside the defined set.`,
    `Classify as "off_topic". Acknowledge briefly that the request is outside current scope and that the task is set aside.`
  )}

<classification_rules>
Classify the user_inbound as one of:
- "continuing" — plausible answer to last_outbound, even if short (e.g. "Critical", "High", "yes", a name).
- "ambiguous"  — equally plausible as an answer or as a new unrelated request; genuinely cannot tell.
- "off_topic"  — clearly unrelated to the task or last_outbound, including any request listed in constraints.

Prefer "continuing" whenever the reply could reasonably be an answer. Apply on_out_of_scope for anything in constraints.
</classification_rules>

<response_rules>
- If "continuing": extract the value for "${nextField}" exactly as stated. ${afterExtraction}
- If "ambiguous": ask "Just to confirm — are you still working on the task we were discussing, or is this something new?"
- If "off_topic": follow the on_out_of_scope protocol.
- Always respond in plain text only — no markdown. This is ${platform}.
</response_rules>

<output_format>
Respond with this JSON and nothing else:
{
  "reply": "<your plain text response>",
  "classification": "continuing" | "ambiguous" | "off_topic",
  "extracted": { "${nextField}": "<value>" }
}
Omit "extracted" when classification is not "continuing".
</output_format>`;

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
