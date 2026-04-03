import { NextResponse } from 'next/server';
import { getAgentGovernance, callLLM } from '@/lib/agent-config';
import { isBlacklisted, logIntake, logCommunication, logAuditTrail } from '@/lib/messaging-ops';
import { writeAuditVault } from '@/lib/security/hash-chain';
import { routeWorkItem } from '@/adapters/router';

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

async function sendTeamsReply(serviceUrl: string, conversationId: string, activityId: string, text: string) {
  const botToken = process.env.TEAMS_BOT_TOKEN!;
  await fetch(`${serviceUrl}/v3/conversations/${conversationId}/activities/${activityId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'message',
      text,
    }),
  });
}

export async function POST(req: Request) {
  try {
    const activity = await req.json();

    // Only handle message activities
    if (activity.type !== 'message') {
      return new NextResponse('OK', { status: 200 });
    }

    const incomingMsg: string = activity.text || '';
    const teamsUserId: string = activity.from?.id || '';
    const activityId: string = activity.id || '';
    const conversationId: string = activity.conversation?.id || '';
    const serviceUrl: string = activity.serviceUrl || '';

    // Stage 0: Log intake
    const intakeLogId = await logIntake({
      platformMessageId: activityId,
      senderId: teamsUserId,
      messageBody: incomingMsg,
      rawPayload: activity,
    });

    // Stage 1: Blacklist check
    const blocked = await isBlacklisted(teamsUserId);
    if (blocked) {
      return new NextResponse('OK', { status: 200 });
    }

    // Stage 2: Identity & Policy Retrieval
    const config = await getAgentGovernance(teamsUserId, 'teams');

    // Stage 3: Hard Governance — input limit
    const limit = config?.max_input_chars ?? 500;
    if (incomingMsg.length > limit) {
      await sendTeamsReply(serviceUrl, conversationId, activityId,
        `Message too long. Your current tier limit is ${limit} characters.`);
      return new NextResponse('OK', { status: 200 });
    }

    // Stage 4: Soft Governance & Intuition
    const maxOutput = config?.max_output_tokens ?? 300;
    const systemPrompt = `${config?.system_prompt ?? 'You are Miyu, a helpful AI assistant.'}
The user is on the ${config?.plan_type ?? 'pilot'} plan. They may send up to ${limit} characters per message. Your replies are capped at ${maxOutput} tokens.
Always respond in plain text only — no markdown, no bullet points, no asterisks, no headers. This is Microsoft Teams.`;

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

    // Stage 5: Route to PM tool if task_request (non-blocking)
    let pmIssueKey: string | undefined;
    if (classification === 'task_request') {
      routeWorkItem({
        title: reply.slice(0, 100),
        description: incomingMsg,
        priority: 'Medium',
        category: classification,
        sourceMessageId: activityId,
        actorPhone: teamsUserId,
      }).then((workItem) => {
        pmIssueKey = workItem?.externalKey;
      }).catch(console.error);
    }

    // Stage 6: Delivery
    const finalReply = truncateAtSentence(reply, 1500);
    await sendTeamsReply(serviceUrl, conversationId, activityId, finalReply);

    // Log communication + audit trail (non-blocking)
    logCommunication({
      platformMessageId: `${activityId}_reply`,
      senderId: teamsUserId,
      messageBody: finalReply,
      rawPayload: { direction: 'outbound', platform: 'teams', model: config?.model_name },
    }).then((commLogId: string | null) =>
      logAuditTrail({
        intakeLogId,
        commLogId,
        inputText: incomingMsg,
        aiSummaryTitle: finalReply.slice(0, 100),
        aiClassification: classification,
        confidenceScore: confidence,
        processingTimeMs,
      })
    ).catch(console.error);

    writeAuditVault({
      actorBsuid: teamsUserId,
      reasoningTrace: {
        input: incomingMsg,
        output: finalReply,
        classification,
        confidence,
        processing_time_ms: processingTimeMs,
        plan_type: config?.plan_type ?? 'pilot',
        platform: 'teams',
        pm_issue_key: pmIssueKey ?? null,
      },
      actionTaken: pmIssueKey
        ? `Teams reply sent to ${teamsUserId} — WorkItem ${pmIssueKey} created`
        : `Teams reply sent to ${teamsUserId}`,
      modelVersion: config?.model_name ?? 'claude-sonnet-4-6',
      promptId: config?.prompt_id ?? 'v1.0',
    }).catch(console.error);

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Miyu Teams Error:', error);
    return new NextResponse('Error', { status: 500 });
  }
}
