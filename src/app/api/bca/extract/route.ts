// POST /api/bca/extract
// Accepts a voice note transcript + project context.
// Runs LLM extraction → saves to site_diary_entries + child tables → returns BCA JSON.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { extractDiaryFromTranscript } from '@/adapters/bca/extract-diary';

export async function POST(req: Request) {
  try {
    const {
      transcript,
      site_project_id,
      report_date,      // YYYY-MM-DD
      intake_log_id,    // optional — links back to the source WhatsApp/Teams message
      lat,
      long,
      geolocation_verified = false,
      platform = 'WhatsApp Voice Note',
    } = await req.json();

    if (!transcript || !site_project_id || !report_date) {
      return NextResponse.json({ error: 'transcript, site_project_id, and report_date are required' }, { status: 400 });
    }

    // Fetch project ref for the BCA metadata
    const { data: project } = await supabase
      .from('site_projects')
      .select('project_ref, uen')
      .eq('id', site_project_id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Site project not found' }, { status: 404 });
    }

    // Run extraction
    const { diary, confidence, flags } = await extractDiaryFromTranscript({
      transcript,
      projectId: project.project_ref,
      reportDate: report_date,
      lat: lat ?? null,
      long: long ?? null,
      geolocationVerified: geolocation_verified,
      platform,
    });

    // Lookup draft status ID
    const { data: draftStatus } = await supabase
      .from('system_status')
      .select('id')
      .eq('domain', 'site_diary')
      .eq('status_code', 'draft')
      .single();

    // Upsert diary entry (unique per project + date)
    const { data: entry, error: entryError } = await supabase
      .from('site_diary_entries')
      .upsert({
        site_project_id,
        intake_log_id: intake_log_id ?? null,
        report_date,
        weather_am:          diary.metadata.weather.am,
        weather_pm:          diary.metadata.weather.pm,
        weather_impact:      diary.metadata.weather.impact_on_work,
        raw_transcript:      transcript,
        structured_json:     diary,
        confidence_score:    confidence,
        status_fk:           draftStatus?.id ?? null,
      }, { onConflict: 'site_project_id,report_date' })
      .select('id')
      .single();

    if (entryError || !entry) {
      console.error('[bca/extract] entry upsert error:', entryError);
      return NextResponse.json({ error: 'Failed to save diary entry' }, { status: 500 });
    }

    const diaryEntryId = entry.id;

    // Insert manpower records (replace existing for this entry)
    await supabase.from('site_diary_manpower').delete().eq('diary_entry_id', diaryEntryId);
    if (diary.manpower_epss_compliance.length > 0) {
      await supabase.from('site_diary_manpower').insert(
        diary.manpower_epss_compliance.map(m => ({
          diary_entry_id:   diaryEntryId,
          worker_id_masked: m.worker_id_masked,
          employer_uen:     m.employer_uen,
          trade_code:       m.trade_code,
          trade_description:m.trade_description,
          time_in:          m.attendance.time_in,
          time_out:         m.attendance.time_out,
          total_man_hours:  m.attendance.total_man_hours,
        }))
      );
    }

    // Insert activities (structural works + concreting)
    await supabase.from('site_diary_activities').delete().eq('diary_entry_id', diaryEntryId);
    const activities = [
      ...diary.site_activities_reg_22.structural_works.map(a => ({
        diary_entry_id:   diaryEntryId,
        activity_type:    'structural_works',
        location:         a.location,
        task_description: a.task,
        activity_status:  a.status,
        verified_by:      a.verified_by_re_rto,
      })),
      ...(diary.site_activities_reg_22.concreting_records ? [{
        diary_entry_id:      diaryEntryId,
        activity_type:       'concreting',
        check_id:            diary.site_activities_reg_22.concreting_records.check_id,
        pre_pour_inspection: diary.site_activities_reg_22.concreting_records.pre_pour_inspection,
        slump_test_result:   diary.site_activities_reg_22.concreting_records.slump_test_result,
        cube_test_id:        diary.site_activities_reg_22.concreting_records.cube_test_id,
        activity_status:     'Completed',
      }] : []),
      ...diary.site_activities_reg_22.instructions_received.map(ins => ({
        diary_entry_id:   diaryEntryId,
        activity_type:    'instruction',
        task_description: ins,
        activity_status:  'Completed',
      })),
    ];
    if (activities.length > 0) {
      await supabase.from('site_diary_activities').insert(activities);
    }

    // Insert materials
    await supabase.from('site_diary_materials').delete().eq('diary_entry_id', diaryEntryId);
    if (diary.logistics_materials.length > 0) {
      await supabase.from('site_diary_materials').insert(
        diary.logistics_materials.map(m => ({
          diary_entry_id:  diaryEntryId,
          item_name:       m.item,
          quantity:        m.quantity,
          unit:            m.unit,
          supplier_uen:    m.supplier_uen,
          do_number:       m.do_number,
          delivery_status: m.status,
        }))
      );
    }

    return NextResponse.json({
      diary_entry_id: diaryEntryId,
      diary,
      confidence,
      flags,
    });
  } catch (error) {
    console.error('[bca/extract]', error);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
