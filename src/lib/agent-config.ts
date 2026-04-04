import { supabase } from './supabase';
import { AnthropicAdapter } from '@/adapters/llm/anthropic';
import type { LLMAdapter } from '@/adapters/llm/types';

// ── Supabase return shape ─────────────────────────────────────────────────────

interface ConfigSettings {
  max_input_chars: number;
  max_output_tokens: number;
  model_provider: string;
  model_name: string;
  temperature: number;
  system_prompt: string;
  prompt_id: string;
  can_access_kb: boolean;
  enable_history: boolean;
  locale_hints: string | null;
}

interface SubscriptionRow {
  plan_type: string;
  plan_tiers: { config_settings: ConfigSettings | ConfigSettings[] }
            | { config_settings: ConfigSettings | ConfigSettings[] }[];
}

export interface AgentGovernance extends ConfigSettings {
  plan_type: string;
  can_assign_tickets: boolean;
  locale_hints: string | null;
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
          enable_history,
          locale_hints
        )
      )
    `)
    .eq(column, identity)
    .single();

  if (error || !data) return null;

  const row = data as unknown as SubscriptionRow;
  const tier = Array.isArray(row.plan_tiers) ? row.plan_tiers[0] : row.plan_tiers;
  const rawConfig = tier?.config_settings;
  const config: ConfigSettings | null = rawConfig
    ? (Array.isArray(rawConfig) ? rawConfig[0] : rawConfig) ?? null
    : null;

  if (!config) return null;

  return { ...config, plan_type: row.plan_type, can_assign_tickets: false };
}

// ── LLM adapter registry (mirrors PM adapter pattern in src/adapters/router.ts) ─

const llmAdapters: Record<string, LLMAdapter> = {
  anthropic: new AnthropicAdapter(),
  // openai:  new OpenAIAdapter(),
  // gemini:  new GeminiAdapter(),
};

function getLLMAdapter(provider: string): LLMAdapter {
  const adapter = llmAdapters[provider];
  if (!adapter) throw new Error(`Unsupported LLM provider: ${provider}`);
  return adapter;
}

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

const HISTORY_WINDOW = 10;

// ── Prompt envelope helpers ───────────────────────────────────────────────────

/** <session_state> — explicit field snapshot + transition delta.
 *  Prevents re-deriving state from history and looping on answered fields. */
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

/** <locale_context> — region-specific language guidance injected when configured.
 *  Tells the model how to interpret dialect, particles, and colloquial phrasing. */
function buildLocaleContext(hints: string | null | undefined): string {
  if (!hints) return '';
  return `<locale_context>\n${hints}\n</locale_context>`;
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
  localeHints,
}: {
  provider: string;
  model: string;
  text: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  canAssignTickets?: boolean;
  localeHints?: string | null;
}): Promise<LLMResult> {
  const recentHistory = conversationHistory.slice(-HISTORY_WINDOW);
  const lastOutbound = recentHistory.filter(t => t.role === 'assistant').at(-1)?.content ?? null;

  const structuredSystem = `${systemPrompt}

${buildLocaleContext(localeHints)}

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
- If last_outbound was a question and the user replied with any answer, accept the answer verbatim — do NOT rephrase, reformat, or ask for confirmation of what they just said. Move to the next question.
- If last_outbound was a confirmation and the user replied "yes", "ok", "sure", or similar, treat it as confirmed — do not ask for clarification.
- Use "general_inquiry", "status_update", or "complaint" for everything else.
</classification_rules>`;

  const taskProperties: Record<string, unknown> = {
    title:       { type: 'string' },
    description: { type: 'string' },
    priority:    { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
    ...(canAssignTickets ? { assigneeEmail: { type: ['string', 'null'] } } : {}),
  };

  try {
    const input = await getLLMAdapter(provider).call({
      model,
      systemPrompt: structuredSystem,
      messages: [...recentHistory, { role: 'user', content: text }],
      tools: [{
        name: 'route_intent',
        description: 'Classify user intent and extract task fields if applicable.',
        input_schema: {
          type: 'object' as const,
          properties: {
            reply:          { type: 'string', description: 'Plain text response to the user, no markdown.' },
            classification: { type: 'string', enum: ['general_inquiry', 'pm.task_request', 'pm.task_incomplete', 'status_update', 'complaint', 'out_of_scope'] },
            confidence:     { type: 'number', description: 'Confidence score 0.0–1.0' },
            task: {
              type: 'object',
              description: 'Required when classification is pm.task_request.',
              properties: taskProperties,
              required: ['title', 'description', 'priority'],
            },
          },
          required: ['reply', 'classification', 'confidence'],
        },
      }],
      toolName: 'route_intent',
      maxTokens,
      temperature,
    });
    return {
      reply:          (input.reply as string)          ?? "I'm sorry, I couldn't process that.",
      classification: (input.classification as string) ?? 'general_inquiry',
      confidence:     (input.confidence as number)     ?? 0.5,
      task:           input.task as TaskFields | undefined,
    };
  } catch (e) {
    console.error('[callLLM] API error:', e);
    return { reply: "I'm sorry, something went wrong. Please try again.", classification: 'general_inquiry', confidence: 0 };
  }
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
  localeHints,
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
  localeHints?: string | null;
}): Promise<GatheringResult> {
  const recentHistory = conversationHistory.slice(-HISTORY_WINDOW);
  const lastOutbound = recentHistory.filter(t => t.role === 'assistant').at(-1)?.content ?? '(none)';

  const hypothetical = { ...taskFields, [nextField]: 'filled' };
  const nextNextField = getNextField(hypothetical, canAssignTickets);
  const afterExtraction = nextNextField
    ? `Then ask for the next missing field: ${FIELD_LABELS[nextNextField]}.`
    : `All required fields will then be complete — reply with a brief confirmation that you have everything and will create the ticket now. Do not mention a ticket number yet.`;

  const gatheringSystem = `${systemPrompt}

${buildLocaleContext(localeHints)}

${buildSessionState(taskFields, nextField, canAssignTickets)}

${buildInteractionAnchor(lastOutbound, text, `Direct answer to field request: ${nextField}`)}

${buildOperationalContract(
    `    - Collect task fields in order: title, description, priority${canAssignTickets ? ', assignee email' : ''}.`,
    `    - Cannot set due dates, update tickets, look up rosters, or collect fields outside the defined set.`,
    `Classify as "off_topic". Acknowledge briefly that the request is outside current scope and that the task is set aside.`
  )}

<classification_rules>
Classify the user_inbound as one of:
- "continuing" — plausible answer to last_outbound, even if short (e.g. "Critical", "High", "yes", a name, a phrase).
- "ambiguous"  — equally plausible as an answer or as a new unrelated request; genuinely cannot tell.
- "off_topic"  — clearly unrelated to the task or last_outbound, including any request listed in constraints.

Prefer "continuing" whenever the reply could reasonably be an answer. Apply on_out_of_scope for anything in constraints.
</classification_rules>

<response_rules>
  <on_continuing>
    <extraction>Extract the value for "${nextField}" VERBATIM from user_inbound into the extracted object. Do not clean, rephrase, or normalise — except strip trailing filler particles if locale_context instructs it.</extraction>
    <reply_template>Got it. ${afterExtraction}</reply_template>
    <forbidden>Do NOT ask again for "${nextField}". Do NOT rephrase, confirm, or request a shorter version of the value just provided. Do NOT add commentary before or after the reply_template.</forbidden>
  </on_continuing>
  <on_ambiguous>
    <reply_template>Just to confirm — are you still working on the task we were discussing, or is this something new?</reply_template>
  </on_ambiguous>
  <on_off_topic>
    <action>Follow the on_out_of_scope protocol defined in operational_contract.</action>
  </on_off_topic>
  <global_constraints>Plain text only — no markdown, no bullet points. This is ${platform}.</global_constraints>
</response_rules>`;

  try {
    const input = await getLLMAdapter(provider).call({
      model,
      systemPrompt: gatheringSystem,
      messages: [{ role: 'user', content: text }],
      tools: [{
        name: 'extract_field',
        description: 'Classify the user reply and extract the field value if the reply is continuing.',
        input_schema: {
          type: 'object' as const,
          properties: {
            reply:          { type: 'string', description: 'Plain text response to the user, no markdown.' },
            classification: { type: 'string', enum: ['continuing', 'ambiguous', 'off_topic'] },
            extracted: {
              type: 'object',
              description: `Include only when classification is "continuing". Provide the extracted value for field: ${nextField}.`,
              properties: {
                title:         { type: 'string' },
                description:   { type: 'string' },
                priority:      { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
                assigneeEmail: { type: ['string', 'null'] },
              },
            },
          },
          required: ['reply', 'classification'],
        },
      }],
      toolName: 'extract_field',
      maxTokens,
      temperature,
    });
    return {
      reply:          (input.reply as string) ?? 'Got it.',
      classification: (input.classification as GatheringResult['classification']) ?? 'continuing',
      extracted:      input.extracted as Partial<TaskFieldsState> | undefined,
    };
  } catch (e) {
    console.error('[callLLMGathering] API error:', e);
    return { reply: 'Got it.', classification: 'continuing', extracted: { [nextField]: text } as Partial<TaskFieldsState> };
  }
}
