import { NextResponse } from 'next/server';
import { getAgentGovernance, callLLM } from '@/lib/agent-config';
import { isBlacklisted, logIntake, logCommunication, logAuditTrail, getConversationState, updateConversationState, getSubscriberEmail } from '@/lib/messaging-ops';
import { writeAuditVault } from '@/lib/security/hash-chain';
import { routeWorkItem } from '@/adapters/router';
import { JiraAdapter } from '@/adapters/jira';

const jira = new JiraAdapter();

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

async function getBotToken(): Promise<string> {
  const tenantId = process.env.TEAMS_TENANT_ID ?? 'botframework.com';
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.TEAMS_APP_ID!,
      client_secret: process.env.TEAMS_CLIENT_SECRET!,
      scope: 'https://api.botframework.com/.default',
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function sendTeamsReply(serviceUrl: string, conversationId: string, activityId: string, text: string) {
  const token = await getBotToken();
  await fetch(`${serviceUrl}/v3/conversations/${conversationId}/activities/${activityId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'message', text }),
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

    // Stage 4: Load conversation history + check Jira assign permission
    const [{ history, gatheringTask }, subscriberEmail] = await Promise.all([
      getConversationState(teamsUserId, 'teams'),
      getSubscriberEmail(teamsUserId, 'teams'),
    ]);

    const projectKey = process.env.JIRA_PROJECT_KEY ?? 'KAN';
    const canAssignTickets = subscriberEmail
      ? await jira.checkAssignPermission(subscriberEmail, projectKey)
      : false;

    const maxOutput = config?.max_output_tokens ?? 300;
    const systemPrompt = `${config?.system_prompt ?? 'You are Miyu, a helpful AI assistant.'}
The user is on the ${config?.plan_type ?? 'pilot'} plan. They may send up to ${limit} characters per message. Your replies are capped at ${maxOutput} tokens.
Always respond in plain text only — no markdown, no bullet points, no asterisks, no headers. This is Microsoft Teams.
${gatheringTask ? 'You are currently collecting task details from the user. Continue asking for the next missing field based on what has already been provided in the conversation.' : ''}`;

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
          sourceMessageId: activityId,
          actorPhone: teamsUserId,
        });
        pmIssueKey = workItem?.externalKey;
      } catch (e) {
        console.error('[Teams] routeWorkItem failed:', e);
      }
    }

    // Stage 6: Delivery — append ticket confirmation if created
    const baseReply = truncateAtSentence(reply, 1500);
    const finalReply = pmIssueKey
      ? `${baseReply}\n\nTicket ${pmIssueKey} has been raised. The team will pick it up shortly.`
      : baseReply;

    await sendTeamsReply(serviceUrl, conversationId, activityId, finalReply);

    // Update conversation history (clear gathering state once ticket is created)
    const updatedHistory = [
      ...history,
      { role: 'user' as const, content: incomingMsg },
      { role: 'assistant' as const, content: reply },
    ];
    const stillGathering = classification === 'pm.task_incomplete';
    updateConversationState(teamsUserId, 'teams', updatedHistory, stillGathering, pmIssueKey).catch(console.error);

    // Log communication + audit trail (non-blocking)
    logCommunication({
      intakeLogId: intakeLogId!,
      platform: 'teams',
      platformMessageId: `${activityId}_reply`,
      senderId: teamsUserId,
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
