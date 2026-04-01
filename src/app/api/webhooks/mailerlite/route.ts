import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const events = body.events;

  if (!events || !events[0]) {
    console.error('No events found. Received body:', JSON.stringify(body));
    return NextResponse.json({ status: 'ignored', reason: 'no_events' }, { status: 200 });
  }

  const email = events[0].data?.subscriber?.email;

  if (!email) {
    console.error('Email not found in subscriber data');
    return NextResponse.json({ status: 'ignored', reason: 'no_email' }, { status: 200 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('waitlist')
      .insert([{ email, source: 'mailerlite' }]);

    if (error && error.code !== '23505') {
      console.error('Supabase Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
