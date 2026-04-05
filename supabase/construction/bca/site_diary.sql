-- Site Diary: BCA Regulation 22 structured entries and child records.
-- Tables (run in order):
--   1. site_diary_entries   — one entry per day per project
--   2. site_diary_manpower  — EPSS worker attendance records
--   3. site_diary_activities — Reg 22 site activities (structural, concreting, instructions)
--   4. site_diary_materials  — logistics / delivery order records

-- ── 1. site_diary_entries ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.site_diary_entries (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_project_id         UUID NOT NULL REFERENCES public.site_projects(id) ON DELETE CASCADE,
    intake_log_id           UUID REFERENCES public.intake_logs(id) ON DELETE SET NULL,

    -- BCA metadata
    report_date             DATE NOT NULL,
    submission_timestamp    TIMESTAMPTZ,

    -- Weather (NEA-enriched)
    weather_am              TEXT,                   -- 'Sunny', 'Cloudy', 'Thundery Showers'
    weather_pm              TEXT,
    weather_impact          TEXT,                   -- e.g. '2-hour delay on structural works'

    -- AI extraction
    raw_transcript          TEXT,                   -- original voice note transcript
    structured_json         JSONB,                  -- full BCA schema (agentic output)
    confidence_score        FLOAT CHECK (confidence_score BETWEEN 0 AND 1),

    -- IMDA human-in-the-loop validation gate
    validated_by            TEXT,                   -- RE / PM display name
    validated_at            TIMESTAMPTZ,

    -- Lifecycle
    status_fk               INT REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_diary_entry_per_day UNIQUE (site_project_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_diary_entries_project ON public.site_diary_entries(site_project_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_date    ON public.site_diary_entries(report_date);
CREATE INDEX IF NOT EXISTS idx_diary_entries_intake  ON public.site_diary_entries(intake_log_id);

-- ── 2. site_diary_manpower ────────────────────────────────────────────────────
-- EPSS-compliant worker attendance — one row per worker per diary entry.

CREATE TABLE IF NOT EXISTS public.site_diary_manpower (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diary_entry_id          UUID NOT NULL REFERENCES public.site_diary_entries(id) ON DELETE CASCADE,

    -- EPSS identity (masked per MOM data governance)
    worker_id_masked        TEXT NOT NULL,          -- e.g. 'SXXXX123A'
    employer_uen            TEXT,

    -- BCA trade classification
    trade_code              TEXT NOT NULL,          -- e.g. 'SS01', 'EL01', 'PL01'
    trade_description       TEXT,                   -- e.g. 'Structural Steel Work'

    -- Attendance
    time_in                 TIME,
    time_out                TIME,
    total_man_hours         NUMERIC(4, 1),

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manpower_diary_entry ON public.site_diary_manpower(diary_entry_id);
CREATE INDEX IF NOT EXISTS idx_manpower_trade_code  ON public.site_diary_manpower(trade_code);

-- ── 3. site_diary_activities ──────────────────────────────────────────────────
-- Regulation 22 site activities: structural works, concreting, instructions.

CREATE TABLE IF NOT EXISTS public.site_diary_activities (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diary_entry_id          UUID NOT NULL REFERENCES public.site_diary_entries(id) ON DELETE CASCADE,

    -- Classification
    activity_type           TEXT NOT NULL,
    CONSTRAINT chk_activity_type CHECK (activity_type IN (
        'structural_works', 'concreting', 'instruction', 'inspection', 'other'
    )),

    -- Location & task (Reg 22 fields)
    location                TEXT,                   -- e.g. 'Block A, Level 4, Grid Line 4-5'
    task_description        TEXT,
    activity_status         TEXT DEFAULT 'In Progress',
    CONSTRAINT chk_activity_status CHECK (activity_status IN (
        'Pending', 'In Progress', 'Completed', 'Deferred'
    )),

    -- RE / RTO verification
    verified_by             TEXT,                   -- e.g. 'Tan Ah Kow (RTO 1234)'

    -- Concreting-specific fields (populated when activity_type = 'concreting')
    check_id                TEXT,                   -- e.g. 'CONC-2026-001'
    pre_pour_inspection     TEXT,                   -- 'Pass' / 'Fail'
    slump_test_result       TEXT,                   -- e.g. '100mm'
    cube_test_id            TEXT,                   -- e.g. 'CUBE-99'

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_diary_entry ON public.site_diary_activities(diary_entry_id);
CREATE INDEX IF NOT EXISTS idx_activities_type        ON public.site_diary_activities(activity_type);

-- ── 4. site_diary_materials ───────────────────────────────────────────────────
-- Logistics and delivery order records per diary entry.

CREATE TABLE IF NOT EXISTS public.site_diary_materials (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diary_entry_id          UUID NOT NULL REFERENCES public.site_diary_entries(id) ON DELETE CASCADE,

    -- Material details
    item_name               TEXT NOT NULL,          -- e.g. 'Grade 40 Concrete'
    quantity                NUMERIC,
    unit                    TEXT,                   -- 'm3', 'tonnes', 'nos'

    -- Supplier & delivery
    supplier_uen            TEXT,
    do_number               TEXT,                   -- Delivery Order number
    delivery_status         TEXT DEFAULT 'Pending',
    CONSTRAINT chk_delivery_status CHECK (delivery_status IN (
        'Pending', 'Delivered', 'Rejected', 'Partial'
    )),

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materials_diary_entry ON public.site_diary_materials(diary_entry_id);
CREATE INDEX IF NOT EXISTS idx_materials_do_number   ON public.site_diary_materials(do_number);
