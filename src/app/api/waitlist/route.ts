import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // 1. Add to MailerLite
  const mlRes = await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
    },
    body: JSON.stringify({
      email,
      groups: ['SG_SME_WAITLIST'],
      status: 'active',
    }),
  });

  if (!mlRes.ok) {
    const err = await mlRes.json();
    return NextResponse.json({ error: err.message ?? 'MailerLite error' }, { status: mlRes.status });
  }

  // 2. Save to Supabase
  const { error } = await supabase
    .from('waitlist')
    .insert([{ email, source: 'landing_page' }]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
