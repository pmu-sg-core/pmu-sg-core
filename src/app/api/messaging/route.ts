import { NextResponse } from 'next/server';
import { Twilio } from 'twilio';
import { getAgentGovernance, callLLM } from '@/lib/agent-config';

const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

function truncateAtSentence(body: string, limit: number): string {
  if (body.length <= limit) return body;
  const truncated = body.slice(0, limit);
  const lastEnd = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?')
  );
  return lastEnd > 0 ? truncated.slice(0, lastEnd + 1) : truncated;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const incomingMsg = (formData.get('Body') as string) || '';
    const sender = formData.get('From') as string; // e.g., whatsapp:+65...

    const senderPhone = sender.replace('whatsapp:', '');
    const config = await getAgentGovernance(senderPhone);

    // 1. Enforce input limit
    const limit = config?.max_input_chars ?? 500;
    if (incomingMsg.length > limit) {
      await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: sender,
        body: `Message too long. Your current tier limit is ${limit} characters.`,
      });
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // 2. Get AI response — append runtime limits from DB to system prompt
    const maxOutput = config?.max_output_tokens ?? 300;
    const systemPrompt = `${config?.system_prompt ?? 'You are Miyu, a helpful AI assistant.'}
The user is on the ${config?.plan_type ?? 'pilot'} plan. They may send up to ${limit} characters per message. Your replies are capped at ${maxOutput} tokens.
Always respond in plain text only — no markdown, no bullet points, no asterisks, no headers. This is WhatsApp.`;

    const aiReply = await callLLM({
      provider: config?.model_provider ?? 'anthropic',
      model: config?.model_name ?? 'claude-sonnet-4-6',
      text: incomingMsg,
      maxTokens: maxOutput,
      temperature: config?.temperature ?? 0.7,
      systemPrompt,
    });

    // 3. Send reply back to WhatsApp
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: sender,
      body: truncateAtSentence(aiReply, 1500),
    });

    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  } catch (error) {
    console.error('Miyu Error:', error);
    return new NextResponse('Error', { status: 500 });
  }
}
