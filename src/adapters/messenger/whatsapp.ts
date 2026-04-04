import { Twilio } from 'twilio';
import type { MessengerAdapter, MessengerContext } from './types';

export class WhatsAppAdapter implements MessengerAdapter {
  channel = 'whatsapp';
  private client: Twilio | null = null;

  private getClient(): Twilio {
    if (!this.client) {
      this.client = new Twilio(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_AUTH_TOKEN!
      );
    }
    return this.client;
  }

  async send(to: string, body: string, _context?: MessengerContext): Promise<void> {
    await this.getClient().messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to,
      body,
    });
  }
}
