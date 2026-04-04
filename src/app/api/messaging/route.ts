import { NextResponse } from 'next/server';
import { Twilio } from 'twilio';
import { getAgentGovernance, callLLM } from '@/lib/agent-config';
import { isBlacklisted, logIntake, logCommunication, logAuditTrail } from '@/lib/messaging-ops';
import { writeAuditVault } from '@/lib/security/hash-chain';
import { routeWorkItem } from '@/adapters/router';

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

async function sendWhatsApp(to: string, body: string) {
  await twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to,
    body,
  });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const incomingMsg = (formData.get('Body') as string) || '';
    const sender = formData.get('From') as string; // e.g., whatsapp:+65...
    const messageSid = (formData.get('MessageSid') as string) || '';

    const senderPhone = sender.replace('whatsapp:', '');

    // Stage 0: Log intake
    const rawPayload: Record<string, unknown> = {};
    formData.forEach((value, key) => { rawPayload[key] = value; });
    const intakeLogId = await logIntake({
      platformMessageId: messageSid,
      senderId: senderPhone,
      messageBody: incomingMsg,
      rawPayload,
    });

    // Stage 1: Blacklist check
    const blocked = await isBlacklisted(senderPhone);
    if (blocked) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Stage 2: Identity & Policy Retrieval
    const config = await getAgentGovernance(senderPhone);

    // Stage 3: Hard Governance — input limit
    const limit = config?.max_input_chars ?? 500;
    if (incomingMsg.length > limit) {
      await sendWhatsApp(sender, `Message too long. Your current tier limit is ${limit} characters.`);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Stage 4: Soft Governance & Intuition
    const maxOutput = config?.max_output_tokens ?? 300;
    const systemPrompt = `${config?.system_prompt ?? 'You are Miyu, a helpful AI assistant.'}
The user is on the ${config?.plan_type ?? 'pilot'} plan. They may send up to ${limit} characters per message. Your replies are capped at ${maxOutput} tokens.
Always respond in plain text only — no markdown, no bullet points, no asterisks, no headers. This is WhatsApp.`;

    const llmStart = Date.now();
    const { reply, classification, confidence } = await callLLM({
      provider: config?.model_provider ?? 'anthropic',
      model: config?.model_name ?? 'claude-sonnet-4-6',
      text: incomingMsg,
      maxTokens: maxOutput,
      temperature: config?.temperature ?? 0.7,
      systemPrompt,
    });
    const processingTimeMs = Date.now() - llmStart;

    // Stage 5: Route to PM tool if classified as task_request (non-blocking)
    let pmIssueKey: string | undefined;
    if (classification === 'task_request') {
      routeWorkItem({
        title: reply.slice(0, 100),
        description: incomingMsg,
        priority: 'Medium',
        category: classification,
        sourceMessageId: messageSid,
        actorPhone: senderPhone,
      }).then((workItem) => {
        pmIssueKey = workItem?.externalKey;
      }).catch(console.error);
    }

    // Stage 6: Delivery
    const finalReply = truncateAtSentence(reply, 1500);
    await sendWhatsApp(sender, finalReply);

    // Log communication + audit trail + vault (non-blocking)
    logCommunication({
      intakeLogId: intakeLogId!,
      platform: 'whatsapp',
      platformMessageId: `${messageSid}_reply`,
      senderId: senderPhone,
      messageBody: finalReply,
      rawPayload: { direction: 'outbound', model: config?.model_name },
    }).then((commLogId: string | null) =>
      logAuditTrail({
        commLogId,
        inputText: incomingMsg,
        aiSummaryTitle: finalReply.slice(0, 100),
        aiClassification: classification,
        confidenceScore: confidence,
        processingTimeMs,
      })
    ).catch(console.error);

    writeAuditVault({
      actorBsuid: senderPhone,
      reasoningTrace: {
        input: incomingMsg,
        output: finalReply,
        classification,
        confidence,
        processing_time_ms: processingTimeMs,
        plan_type: config?.plan_type ?? 'pilot',
        pm_issue_key: pmIssueKey ?? null,
      },
      actionTaken: pmIssueKey
        ? `WhatsApp reply sent to ${senderPhone} — WorkItem ${pmIssueKey} created`
        : `WhatsApp reply sent to ${senderPhone}`,
      modelVersion: config?.model_name ?? 'claude-sonnet-4-6',
      promptId: config?.prompt_id ?? 'v1.0',
    }).catch(console.error);

    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  } catch (error) {
    console.error('Miyu Error:', error);
    return new NextResponse('Error', { status: 500 });
  }
}
