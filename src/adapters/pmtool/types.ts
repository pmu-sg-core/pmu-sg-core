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
