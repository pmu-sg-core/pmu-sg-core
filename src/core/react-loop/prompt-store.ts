// Single source of truth for all prompt envelope builders.
// agent-config.ts (orchestration) and future react-loop/index.ts import from here.

import type { TaskFieldsState } from '@/lib/agent-config';

const FIELD_ORDER: (keyof TaskFieldsState)[] = ['title', 'description', 'priority', 'assigneeEmail'];

// ── Envelope builders ─────────────────────────────────────────────────────────

/** <session_state> — explicit field snapshot + transition delta.
 *  Prevents re-deriving state from history and looping on answered fields. */
export function buildSessionState(
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
export function buildInteractionAnchor(
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
export function normalModeIntentHint(lastOutbound: string | null): string {
  if (!lastOutbound) return 'Opening message in new conversation.';
  if (lastOutbound.trimEnd().endsWith('?')) return 'Direct answer or response to the previous question.';
  if (/\b(confirm|shall I|go ahead|update|creat|rais)\b/i.test(lastOutbound)) return 'Confirmation of a proposed action.';
  return 'Follow-up reply in ongoing conversation.';
}

/** <locale_context> — region-specific language guidance injected when configured.
 *  Tells the model how to interpret dialect, particles, and colloquial phrasing. */
export function buildLocaleContext(hints: string | null | undefined): string {
  if (!hints) return '';
  return `<locale_context>\n${hints}\n</locale_context>`;
}

/** <operational_contract> — hard capability boundary + failure protocol.
 *  Prevents capability hallucination and defines the pivot on out-of-scope requests. */
export function buildOperationalContract(
  capabilities: string[],
  constraints: string[],
  onOutOfScope: string,
): string {
  const cap = capabilities.map(c => `    <item>${c}</item>`).join('\n');
  const con = constraints.map(c => `    <item>${c}</item>`).join('\n');
  return `<operational_contract>
  <capabilities>
${cap}
  </capabilities>
  <constraints>
${con}
  </constraints>
  <exception_handling>
    <on_out_of_scope>${onOutOfScope}</on_out_of_scope>
  </exception_handling>
</operational_contract>`;
}
