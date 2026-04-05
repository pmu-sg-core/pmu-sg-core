// GET /api/bca/pdf?diary_id=xxx
// Fetches a site diary entry and renders it as a branded PDF.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { renderToStream } from '@react-pdf/renderer';
import { DiaryPDF } from '@/adapters/bca/DiaryPDF';
import type { BcaDiaryJSON } from '@/adapters/bca/extract-diary';
import { createElement } from 'react';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const diaryId = searchParams.get('diary_id');

  if (!diaryId) {
    return NextResponse.json({ error: 'Missing diary_id' }, { status: 400 });
  }

  const { data: entry } = await supabase
    .from('site_diary_entries')
    .select(`
      structured_json,
      report_date,
      site_projects ( project_ref, project_name )
    `)
    .eq('id', diaryId)
    .single();

  if (!entry?.structured_json) {
    return NextResponse.json({ error: 'Diary entry not found or not yet extracted' }, { status: 404 });
  }

  const diary = entry.structured_json as BcaDiaryJSON;
  const project = entry.site_projects as any;
  const filename = `pmu-sg-site-diary-${project?.project_ref ?? diaryId.slice(0, 8)}-${entry.report_date}.pdf`;

  const stream = await renderToStream(createElement(DiaryPDF, { diary }) as any);

  // Convert Node.js Readable to Web ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      (stream as any).on('data', (chunk: Buffer) => controller.enqueue(chunk));
      (stream as any).on('end', () => controller.close());
      (stream as any).on('error', (err: Error) => controller.error(err));
    },
  });

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
