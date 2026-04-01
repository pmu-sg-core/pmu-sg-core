import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
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

  if (!res.ok) {
    const error = await res.json();
    return NextResponse.json({ error: error.message ?? 'Failed to subscribe' }, { status: res.status });
  }

  return NextResponse.json({ success: true });
}
