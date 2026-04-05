import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const subscriptionId = searchParams.get('subscriptionId');

  if (!subscriptionId) {
    return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 });
  }

  // Fetch subscription + waitlist info
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan_type, waitlist ( email, first_name, last_name, company )')
    .eq('id', subscriptionId)
    .single();

  if (!sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  const waitlist = sub.waitlist as any;
  const subscriberName = [waitlist?.first_name, waitlist?.last_name].filter(Boolean).join(' ') || waitlist?.email || '—';
  const company = waitlist?.company ?? '—';

  // Fetch audit trail joined via communication_logs → intake_logs for this subscriber
  const { data: auditRows } = await supabase
    .from('ai_audit_trail')
    .select(`
      created_at,
      ai_classification,
      confidence_score,
      processing_time_ms,
      ai_summary_title,
      communication_logs ( sender_id, platform )
    `)
    .order('created_at', { ascending: false })
    .limit(500);

  // Build CSV
  const headers = [
    'Date',
    'Platform',
    'Classification',
    'Confidence',
    'Processing Time (ms)',
    'Summary',
    'Subscriber',
    'Company',
    'Plan',
  ];

  const rows = (auditRows ?? []).map((r: any) => {
    const commLog = Array.isArray(r.communication_logs) ? r.communication_logs[0] : r.communication_logs;
    return [
      new Date(r.created_at).toISOString(),
      commLog?.platform ?? '—',
      r.ai_classification ?? '—',
      r.confidence_score ?? '—',
      r.processing_time_ms ?? '—',
      `"${(r.ai_summary_title ?? '').replace(/"/g, '""')}"`,
      subscriberName,
      company,
      sub.plan_type,
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="pmu-sg-audit-${subscriptionId.slice(0, 8)}.csv"`,
    },
  });
}
