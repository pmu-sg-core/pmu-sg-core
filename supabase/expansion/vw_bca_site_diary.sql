-- BCA Site Diary Analytics Views
-- Follows the same join pattern as vw_ontology_dashboard.sql:
--   site_diary_entries → site_projects → subscriptions → intake_logs → ai_audit_trail
--
-- Run AFTER: bca_ontology.sql, site_projects.sql, site_diary.sql

-- ── 1. vw_bca_diary_pipeline ──────────────────────────────────────────────────
-- One row per diary entry. Core operational view for admin dashboard.

DROP VIEW IF EXISTS public.vw_bca_diary_pipeline;

CREATE VIEW public.vw_bca_diary_pipeline AS
SELECT
    de.id                           AS diary_id,
    de.report_date,
    de.submission_timestamp,
    de.weather_am,
    de.weather_pm,
    de.weather_impact,
    de.confidence_score,
    de.validated_by,
    de.validated_at,
    de.created_at,

    -- Status
    ss.status_code                  AS status_code,
    ss.label                        AS status_label,

    -- Site project
    sp.project_ref,
    sp.uen,
    sp.project_name,
    sp.address,
    sp.lat,
    sp.long,

    -- Subscription / plan
    sub.id                          AS subscription_id,
    sub.plan_type,

    -- Source intake (voice note)
    il.sender_id,
    il.message_body                 AS source_message,

    -- Linked AI audit record
    aat.ai_classification,
    aat.confidence_score            AS ai_confidence,
    aat.processing_time_ms,

    -- Child record counts
    (SELECT COUNT(*) FROM public.site_diary_manpower   m WHERE m.diary_entry_id = de.id) AS manpower_count,
    (SELECT COUNT(*) FROM public.site_diary_activities a WHERE a.diary_entry_id = de.id) AS activity_count,
    (SELECT COUNT(*) FROM public.site_diary_materials  mat WHERE mat.diary_entry_id = de.id) AS materials_count

FROM public.site_diary_entries de
JOIN  public.site_projects sp        ON sp.id  = de.site_project_id
JOIN  public.subscriptions sub       ON sub.id = sp.subscription_id
LEFT JOIN public.system_status ss    ON ss.id  = de.status_fk
LEFT JOIN public.intake_logs il      ON il.id  = de.intake_log_id
LEFT JOIN public.communication_logs cl ON cl.intake_log_id = il.id
LEFT JOIN public.ai_audit_trail aat  ON aat.comm_log_id = cl.id;

-- ── 2. vw_bca_daily_summary ───────────────────────────────────────────────────
-- One row per project per day. Mirrors vw_daily_metrics pattern.

DROP VIEW IF EXISTS public.vw_bca_daily_summary;

CREATE VIEW public.vw_bca_daily_summary AS
SELECT
    sp.project_ref,
    sp.project_name,
    de.report_date,
    sub.plan_type,
    COUNT(de.id)                                                AS entries_submitted,
    COUNT(CASE WHEN ss.status_code = 'submitted' THEN 1 END)   AS validated_entries,
    COUNT(CASE WHEN ss.status_code = 'draft' THEN 1 END)       AS pending_entries,
    SUM(m.total_man_hours)                                      AS total_man_hours,
    COUNT(DISTINCT m.trade_code)                                AS distinct_trades,
    COUNT(DISTINCT mat.id)                                      AS materials_delivered,
    AVG(de.confidence_score)                                    AS avg_ai_confidence
FROM public.site_diary_entries de
JOIN  public.site_projects sp        ON sp.id  = de.site_project_id
JOIN  public.subscriptions sub       ON sub.id = sp.subscription_id
LEFT JOIN public.system_status ss    ON ss.id  = de.status_fk
LEFT JOIN public.site_diary_manpower m  ON m.diary_entry_id = de.id
LEFT JOIN public.site_diary_materials mat ON mat.diary_entry_id = de.id
    AND mat.delivery_status = 'Delivered'
GROUP BY sp.project_ref, sp.project_name, de.report_date, sub.plan_type;

-- ── 3. vw_bca_manpower_compliance ────────────────────────────────────────────
-- Per trade per day. Supports EPSS audit and BCA CPD submission.

DROP VIEW IF EXISTS public.vw_bca_manpower_compliance;

CREATE VIEW public.vw_bca_manpower_compliance AS
SELECT
    sp.project_ref,
    de.report_date,
    m.trade_code,
    m.trade_description,
    COUNT(m.id)              AS worker_count,
    SUM(m.total_man_hours)   AS total_man_hours,
    MIN(m.time_in)           AS earliest_time_in,
    MAX(m.time_out)          AS latest_time_out,
    sub.plan_type
FROM public.site_diary_manpower m
JOIN public.site_diary_entries de ON de.id = m.diary_entry_id
JOIN public.site_projects sp      ON sp.id = de.site_project_id
JOIN public.subscriptions sub     ON sub.id = sp.subscription_id
GROUP BY sp.project_ref, de.report_date, m.trade_code, m.trade_description, sub.plan_type;
