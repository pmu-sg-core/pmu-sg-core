// PM domain types: task field collection state + canonical work item representation.
// Imported by prompt-store, orchestration, and PM adapters alike — no circular deps.

// ── Task field collection (gathering phase) ───────────────────────────────────

export interface TaskFieldsState {
  title?: string;
  description?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  assigneeEmail?: string;
}

export interface TaskFields {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assigneeEmail?: string;
}

export const FIELD_ORDER: (keyof TaskFieldsState)[] = ['title', 'description', 'priority', 'assigneeEmail'];

export const FIELD_LABELS: Record<keyof TaskFieldsState, string> = {
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

// ── Canonical work item (execution phase) ─────────────────────────────────────

// The canonical internal representation of a work item.
// All PM tool adapters translate to/from this format.

export interface WorkItem {
  // Identity
  externalKey?: string;        // e.g. PROJ-123 (set after creation in PM tool)
  platform: string;            // 'jira' | 'monday' | 'asana' | 'trello'

  // Core Fields
  title: string;               // Short summary / ticket name
  description: string;         // Full detail
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status?: string;             // Current status in the PM tool

  // Routing
  projectKey: string;          // PM project key (from pm_project_routing)
  category?: string;           // Category that drove the routing decision

  // Assignment
  assigneeEmail?: string;      // Jira email of the assignee (resolved to accountId by adapter)

  // Traceability
  sourceMessageId?: string;    // intake_logs.platform_message_id
  commLogId?: string;          // communication_logs.id
  actorPhone?: string;         // Sender's phone number
  createdAt: string;           // ISO timestamp
}

// Interface all adapters must implement
export interface PMAdapter {
  platform: string;
  createWorkItem(item: WorkItem): Promise<WorkItem>; // Returns item with externalKey set
  getWorkItem(externalKey: string): Promise<WorkItem | null>;
  checkAssignPermission(email: string, projectKey: string): Promise<boolean>;
}
