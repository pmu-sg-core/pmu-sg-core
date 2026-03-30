// src/adapters/jira/index.ts

export async function createJiraTicket(summary: string, description: string) {
  const domain = process.env.JIRA_DOMAIN;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  const response = await fetch(`https://${domain}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        project: { key: 'PMU' },
        summary,
        description: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }]
        },
        issuetype: { name: 'Task' }
      }
    })
  });

  return response.json();
}// Read-only & Create-only Jira Adapters