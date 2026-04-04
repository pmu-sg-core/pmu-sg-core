import type { MessengerAdapter, MessengerContext } from './types';

export class TeamsAdapter implements MessengerAdapter {
  channel = 'teams';

  private async getBotToken(): Promise<string> {
    const tenantId = process.env.TEAMS_TENANT_ID ?? 'botframework.com';
    const res = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: process.env.TEAMS_APP_ID!,
          client_secret: process.env.TEAMS_CLIENT_SECRET!,
          scope: 'https://api.botframework.com/.default',
        }),
      }
    );
    const data = await res.json();
    return data.access_token;
  }

  async send(to: string, body: string, context?: MessengerContext): Promise<void> {
    const { serviceUrl, conversationId, activityId } = context ?? {};
    if (!serviceUrl || !conversationId || !activityId) {
      throw new Error('[TeamsAdapter] send() requires serviceUrl, conversationId, and activityId in context.');
    }
    const token = await this.getBotToken();
    await fetch(`${serviceUrl}/v3/conversations/${conversationId}/activities/${activityId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'message', text: body }),
    });
  }
}
