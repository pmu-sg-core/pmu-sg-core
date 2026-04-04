import type { WorkItem, PMAdapter } from './types';

export class JiraAdapter implements PMAdapter {
  platform = 'jira';

  private get headers() {
    const email = process.env.JIRA_EMAIL!;
    const token = process.env.JIRA_API_TOKEN!;
    return {
      'Authorization': `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
  }

  private get baseUrl() {
    return `${process.env.JIRA_BASE_URL}/rest/api/3`;
  }

  private toJiraPriority(priority: WorkItem['priority']): string {
    const map: Record<WorkItem['priority'], string> = {
      Low: 'Low',
      Medium: 'Medium',
      High: 'High',
      Critical: 'Highest',
    };
    return map[priority];
  }

  // Look up a Jira user by email, return their accountId or null
  async findUserByEmail(email: string): Promise<string | null> {
    const res = await fetch(
      `${this.baseUrl}/user/search?query=${encodeURIComponent(email)}`,
      { headers: this.headers }
    );
    if (!res.ok) return null;
    const users: Array<{ accountId: string; emailAddress?: string }> = await res.json();
    const match = users.find(u => u.emailAddress?.toLowerCase() === email.toLowerCase());
    return match?.accountId ?? null;
  }

  // Check if a user (by accountId) is assignable in the given project,
  // which is the best proxy for having ASSIGN_ISSUES permission via the public API.
  async canAssignInProject(accountId: string, projectKey: string): Promise<boolean> {
    const res = await fetch(
      `${this.baseUrl}/user/assignable/search?project=${encodeURIComponent(projectKey)}&accountId=${encodeURIComponent(accountId)}`,
      { headers: this.headers }
    );
    if (!res.ok) return false;
    const users: Array<{ accountId: string }> = await res.json();
    return users.some(u => u.accountId === accountId);
  }

  // Convenience: resolve email → accountId → project permission check
  async checkAssignPermission(email: string, projectKey: string): Promise<boolean> {
    try {
      const accountId = await this.findUserByEmail(email);
      if (!accountId) return false;
      return this.canAssignInProject(accountId, projectKey);
    } catch {
      return false;
    }
  }

  async createWorkItem(item: WorkItem): Promise<WorkItem> {
    const assigneeAccountId = item.assigneeEmail
      ? await this.findUserByEmail(item.assigneeEmail).catch(() => null)
      : null;

    const response = await fetch(`${this.baseUrl}/issue`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        fields: {
          project: { key: item.projectKey },
          summary: item.title,
          description: {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: item.description }] }],
          },
          issuetype: { name: 'Task' },
          priority: { name: this.toJiraPriority(item.priority) },
          ...(assigneeAccountId ? { assignee: { accountId: assigneeAccountId } } : {}),
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Jira] Create issue failed:', response.status, JSON.stringify(data));
      throw new Error(`Jira API error ${response.status}: ${data.errorMessages?.join(', ') ?? JSON.stringify(data.errors)}`);
    }
    console.log('[Jira] Issue created:', data.key);
    return { ...item, externalKey: data.key };
  }

  async getWorkItem(externalKey: string): Promise<WorkItem | null> {
    const response = await fetch(`${this.baseUrl}/issue/${externalKey}`, {
      headers: this.headers,
    });

    if (!response.ok) return null;
    const data = await response.json();

    return {
      externalKey: data.key,
      platform: 'jira',
      title: data.fields.summary,
      description: data.fields.description?.content?.[0]?.content?.[0]?.text ?? '',
      priority: data.fields.priority?.name ?? 'Medium',
      status: data.fields.status?.name,
      projectKey: data.fields.project?.key,
      createdAt: data.fields.created,
    };
  }
}
