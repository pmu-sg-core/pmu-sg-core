// src/app/api/webhooks/whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateWhatsAppSignature } from '@/lib/security/webhook-validator';

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get('x-hub-signature-256') || '';
  const appSecret = process.env.WHATSAPP_APP_SECRET!;

  // 1. Security Check
  if (!validateWhatsAppSignature(payload, signature, appSecret)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const data = JSON.parse(payload);
  const message = data.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message) return NextResponse.json({ status: 'no_message' });

  // 2. Extract Data (Text or Voice)
  const userMessage = message.text?.body || "[Voice Message]";
  const bsuid = message.from; // WhatsApp Number

  // 3. Trigger Miyu Agent Core (Async)
  // In MVP, we fire and forget or use a queue to respond quickly to Meta
  console.log(`Miyu received from ${bsuid}: ${userMessage}`);

  return NextResponse.json({ status: 'received' });
}

// WhatsApp Verification (Required for setup)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge);
  }
  return new NextResponse('Forbidden', { status: 403 });
}