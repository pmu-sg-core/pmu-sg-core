// Canonical contract for all messenger channel adapters.
// Mirrors the PMAdapter pattern in src/adapters/pmtool/types.ts.

export interface MessengerContext {
  // Teams-specific routing (unused for WhatsApp)
  serviceUrl?: string;
  conversationId?: string;
  activityId?: string;
}

export interface MessengerAdapter {
  channel: string;
  send(to: string, body: string, context?: MessengerContext): Promise<void>;
}
