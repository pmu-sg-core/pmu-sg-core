import { NextResponse } from 'next/server';
import { Twilio } from 'twilio';
import { getAgentGovernance, callLLM } from '@/lib/agent-config';
import { isBlacklisted, logIntake, logCommunication, logAuditTrail, getConversationState, updateConversationState, rotateConversationState, getSubscriberEmail } from '@/lib/messaging-ops';
import { writeAuditVault } from '@/lib/security/hash-chain';
import { routeWorkItem, checkCanAssign } from '@/adapters/router';

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

    // Stage 4: Load conversation history + check Jira assign permission
    const [{ history, gatheringTask }, subscriberEmail] = await Promise.all([
      getConversationState(senderPhone, 'whatsapp'),
      getSubscriberEmail(senderPhone, 'whatsapp'),
    ]);

    const canAssignTickets = subscriberEmail
      ? await checkCanAssign('pm.task_request', subscriberEmail)
      : false;

    const maxOutput = config?.max_output_tokens ?? 300;
    const systemPrompt = `${config?.system_prompt ?? 'You are Miyu, a helpful AI assistant.'}
The user is on the ${config?.plan_type ?? 'pilot'} plan. They may send up to ${limit} characters per message. Your replies are capped at ${maxOutput} tokens.
Always respond in plain text only — no markdown, no bullet points, no asterisks, no headers. This is WhatsApp.
${gatheringTask ? 'You have an active task collection in progress. First assess whether the user\'s latest message clearly continues that task. If yes, ask for the next missing field. If the intent is ambiguous or unclear, use pm.task_resume_pending and probe for confirmation before continuing.' : ''}`;

    const llmStart = Date.now();
    const { reply, classification, confidence, task } = await callLLM({
      provider: config?.model_provider ?? 'anthropic',
      model: config?.model_name ?? 'claude-sonnet-4-6',
      text: incomingMsg,
      maxTokens: maxOutput,
      temperature: config?.temperature ?? 0.7,
      systemPrompt,
      conversationHistory: history,
      canAssignTickets,
    });
    const processingTimeMs = Date.now() - llmStart;

    // Stage 5: Route to PM tool if all task fields collected
    let pmIssueKey: string | undefined;
    if (classification === 'pm.task_request' && task) {
      try {
        const workItem = await routeWorkItem({
          title: task.title,
          description: task.description,
          priority: task.priority,
          assigneeEmail: task.assigneeEmail ?? undefined,
          category: classification,
          sourceMessageId: messageSid,
          actorPhone: senderPhone,
        });
        pmIssueKey = workItem?.externalKey;
      } catch (e) {
        console.error('[WhatsApp] routeWorkItem failed:', e);
      }
    }

    // Stage 6: Delivery — append ticket confirmation if created
    const baseReply = truncateAtSentence(reply, 1500);
    const finalReply = pmIssueKey
      ? `${baseReply}\n\nTicket ${pmIssueKey} has been raised. The team will pick it up shortly.`
      : baseReply;

    await sendWhatsApp(sender, finalReply);

    // Update conversation history
    const currentTurn = [
      { role: 'user' as const, content: incomingMsg },
      { role: 'assistant' as const, content: reply },
    ];
    const stillGathering = classification === 'pm.task_incomplete' || classification === 'pm.task_resume_pending';
    const unrelated = gatheringTask && !stillGathering;
    if (unrelated) {
      // Retire the interrupted task conversation; open a fresh one for this new topic
      rotateConversationState(senderPhone, 'whatsapp', currentTurn).catch(console.error);
    } else {
      const updatedHistory = [...history, ...currentTurn];
      updateConversationState(senderPhone, 'whatsapp', updatedHistory, stillGathering, pmIssueKey).catch(console.error);
    }

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
