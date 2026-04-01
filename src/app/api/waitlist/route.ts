import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  console.log("FULL BODY RECEIVED:", JSON.stringify(req.body, null, 2));

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }


  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mailerLiteKey = process.env.MAILERLITE_API_KEY;

  // 1. Add to MailerLite
  if (mailerLiteKey) {
    const mlRes = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mailerLiteKey}`,
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
  }

  // 2. Save to Supabase
  if (supabaseUrl && supabaseKey) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('waitlist')
      .insert([{ email, source: 'landing_page' }]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
