import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const events = body.events;

  if (!events || events.length === 0) {
    return NextResponse.json({ message: 'No events found' }, { status: 200 });
  }

  const subscriber = events[0]?.data?.subscriber;
  const email = subscriber?.email;

  if (!email) {
    return NextResponse.json({ message: 'No email found' }, { status: 200 });
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
      // 23505 = unique violation (already exists), safe to ignore
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
