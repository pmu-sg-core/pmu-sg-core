-- ============================================================
-- PURGE ALL — Full database reset for development/testing
-- ⚠️  NEVER run in production — all data will be permanently lost
-- ============================================================
-- Two sections:
--   Section A — Transactional data only (safe for staging resets)
--   Section B — Full purge including seed/reference data (nuclear)
-- Run Section A OR Section B, not both.
-- ============================================================


-- ── Section A: Transactional Data Only ───────────────────────────────────────
-- Clears all user-generated data. Preserves reference tables:
-- system_status, plan_tiers, config_settings, pm_project_routing,
-- pm_status_mapping, status_reply_templates, business_functions,
-- channels, intent_taxonomy, system_adapters, plan_entitlements,
-- retention_policies, actors (keeps Miyu seed)

TRUNCATE TABLE
    public.audit_vault,
    public.ai_audit_trail,
    public.communication_attachments,
    public.communication_logs,
    public.intake_logs,
    public.active_conversations,
    public.agent_memory,
    public.pending_actions_queue,
    public.actor_identities,
    public.subscriptions,
    public.waitlist,
    public.profiles,
    public.organizations,
    public.governance_blacklist,
    public.user_roles
RESTART IDENTITY CASCADE;


-- ── Section B: Full Nuclear Purge (reference data + transactional) ───────────
-- Drops ALL rows including seeds. You must re-run all migration files after this.
-- Uncomment to use.

/*
TRUNCATE TABLE
    public.audit_vault,
    public.ai_audit_trail,
    public.communication_attachments,
    public.communication_logs,
    public.intake_logs,
    public.active_conversations,
    public.agent_memory,
    public.pending_actions_queue,
    public.actor_identities,
    public.actors,
    public.subscriptions,
    public.waitlist,
    public.profiles,
    public.organizations,
    public.governance_blacklist,
    public.user_roles,
    public.retention_policies,
    public.plan_entitlements,
    public.system_adapters,
    public.intent_taxonomy,
    public.config_settings,
    public.pm_project_routing,
    public.pm_status_mapping,
    public.status_reply_templates,
    public.channels,
    public.business_functions,
    public.plan_tiers,
    public.system_status
RESTART IDENTITY CASCADE;
*/
