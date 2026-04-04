import { NextResponse } from 'next/server';
import { getAgentGovernance, callLLM, callLLMGathering, getNextField } from '@/lib/agent-config';
import { isBlacklisted, logIntake, logCommunication, logAuditTrail, getConversationState, updateConversationState, rotateConversationState, getSubscriberEmail } from '@/lib/messaging-ops';
import { writeAuditVault } from '@/lib/security/hash-chain';
import { routeWorkItem, checkCanAssign } from '@/adapters/router';
import { WhatsAppAdapter } from '@/adapters/messenger/whatsapp';

const messenger = new WhatsAppAdapter();

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
    const sender = formData.get('From') as string;
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
      await messenger.send(sender, `Message too long. Your current tier limit is ${limit} characters.`);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Stage 4: Load conversation state + check Jira assign permission
    const [{ history, gatheringTask, taskFields }, subscriberEmail] = await Promise.all([
      getConversationState(senderPhone, 'whatsapp'),
      getSubscriberEmail(senderPhone, 'whatsapp'),
    ]);

    const canAssignTickets = subscriberEmail
      ? await checkCanAssign('pm.task_request', subscriberEmail)
      : false;

    const maxOutput = config?.max_output_tokens ?? 300;
    const baseSystemPrompt = `${config?.system_prompt ?? 'You are Miyu, a helpful AI assistant.'}
The user is on the ${config?.plan_type ?? 'pilot'} plan. They may send up to ${limit} characters per message. Your replies are capped at ${maxOutput} tokens.
Always respond in plain text only — no markdown, no bullet points, no asterisks, no headers. This is WhatsApp.`;

    const llmStart = Date.now();

    let reply: string;
    let classification: string;
    let confidence: number = 1.0;
    let pmIssueKey: string | undefined;
    let updatedTaskFields = { ...taskFields };
    let stillGathering = false;

    const nextField = getNextField(taskFields, canAssignTickets);

    if (gatheringTask && nextField) {
      // ── Gathering mode: focused extraction ──────────────────────────────────
      const result = await callLLMGathering({
        provider: config?.model_provider ?? 'anthropic',
        model: config?.model_name ?? 'claude-sonnet-4-6',
        text: incomingMsg,
        maxTokens: maxOutput,
        temperature: config?.temperature ?? 0.7,
        systemPrompt: baseSystemPrompt,
        conversationHistory: history,
        taskFields,
        nextField,
        canAssignTickets,
        platform: 'WhatsApp',
      });

      reply = result.reply;
      classification = result.classification;

      if (result.classification === 'off_topic') {
        // Retire current task conversation; open fresh one
        const currentTurn = [
          { role: 'user' as const, content: incomingMsg },
          { role: 'assistant' as const, content: reply },
        ];
        rotateConversationState(senderPhone, 'whatsapp', currentTurn).catch(console.error);
        await messenger.send(sender, truncateAtSentence(reply, 1500));
        logPost({ intakeLogId, senderPhone, messageSid, incomingMsg, reply, classification, confidence, config, processingTimeMs: Date.now() - llmStart });
        return xmlOk();
      }

      if (result.classification === 'ambiguous') {
        stillGathering = true;
      } else {
        // continuing — merge extracted field
        updatedTaskFields = { ...taskFields, ...result.extracted };
        const newNextField = getNextField(updatedTaskFields, canAssignTickets);

        if (!newNextField) {
          // All fields collected — create ticket
          classification = 'pm.task_request';
          try {
            const workItem = await routeWorkItem({
              title: updatedTaskFields.title!,
              description: updatedTaskFields.description!,
              priority: updatedTaskFields.priority!,
              assigneeEmail: updatedTaskFields.assigneeEmail ?? undefined,
              category: 'pm.task_request',
              sourceMessageId: messageSid,
              actorPhone: senderPhone,
            });
            pmIssueKey = workItem?.externalKey;
          } catch (e) {
            console.error('[WhatsApp] routeWorkItem failed:', e);
          }
          stillGathering = false;
        } else {
          stillGathering = true;
        }
      }
    } else {
      // ── Normal mode: intent classification ──────────────────────────────────
      const result = await callLLM({
        provider: config?.model_provider ?? 'anthropic',
        model: config?.model_name ?? 'claude-sonnet-4-6',
        text: incomingMsg,
        maxTokens: maxOutput,
        temperature: config?.temperature ?? 0.7,
        systemPrompt: baseSystemPrompt,
        conversationHistory: history,
        canAssignTickets,
      });

      reply = result.reply;
      classification = result.classification;
      confidence = result.confidence;

      if (classification === 'pm.task_request' && result.task) {
        // All fields provided in one shot
        try {
          const workItem = await routeWorkItem({
            title: result.task.title,
            description: result.task.description,
            priority: result.task.priority,
            assigneeEmail: result.task.assigneeEmail ?? undefined,
            category: classification,
            sourceMessageId: messageSid,
            actorPhone: senderPhone,
          });
          pmIssueKey = workItem?.externalKey;
        } catch (e) {
          console.error('[WhatsApp] routeWorkItem failed:', e);
        }
        stillGathering = false;
      } else {
        stillGathering = classification === 'pm.task_incomplete';
      }
    }

    const processingTimeMs = Date.now() - llmStart;

    // Stage 5: Delivery
    const baseReply = truncateAtSentence(reply, 1500);
    const finalReply = pmIssueKey
      ? `${baseReply}\n\nTicket ${pmIssueKey} has been raised. The team will pick it up shortly.`
      : baseReply;

    await messenger.send(sender, finalReply);

    // Stage 6: Persist state
    const updatedHistory = [
      ...history,
      { role: 'user' as const, content: incomingMsg },
      { role: 'assistant' as const, content: reply },
    ];
    updateConversationState(senderPhone, 'whatsapp', updatedHistory, stillGathering, updatedTaskFields, pmIssueKey).catch(console.error);

    // Audit (non-blocking)
    logPost({ intakeLogId, senderPhone, messageSid, incomingMsg, reply: finalReply, classification, confidence, config, processingTimeMs, pmIssueKey });

    return xmlOk();
  } catch (error) {
    console.error('Miyu Error:', error);
    return new NextResponse('Error', { status: 500 });
  }
}

function xmlOk() {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  );
}

function logPost(params: {
  intakeLogId: string | null;
  senderPhone: string;
  messageSid: string;
  incomingMsg: string;
  reply: string;
  classification: string;
  confidence: number;
  config: any;
  processingTimeMs: number;
  pmIssueKey?: string;
}) {
  const { intakeLogId, senderPhone, messageSid, incomingMsg, reply, classification, confidence, config, processingTimeMs, pmIssueKey } = params;
  logCommunication({
    intakeLogId: intakeLogId!,
    platform: 'whatsapp',
    platformMessageId: `${messageSid}_reply`,
    senderId: senderPhone,
    messageBody: reply,
    rawPayload: { direction: 'outbound', model: config?.model_name },
  }).then((commLogId: string | null) =>
    logAuditTrail({
      commLogId,
      inputText: incomingMsg,
      aiSummaryTitle: reply.slice(0, 100),
      aiClassification: classification,
      confidenceScore: confidence,
      processingTimeMs,
    })
  ).catch(console.error);

  writeAuditVault({
    actorBsuid: senderPhone,
    reasoningTrace: {
      input: incomingMsg,
      output: reply,
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
}
