-- Debug: Message Flow Audit
-- Run each query separately in Supabase SQL editor

-- 1. Check the message was received
SELECT id, sender_id, message_body, created_at
FROM intake_logs
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check Miyu's reply was logged
SELECT id, sender_id, message_body, raw_payload->>'platform' AS platform, created_at
FROM communication_logs
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check audit trail with classification + confidence
SELECT
  input_text,
  ai_summary_title,
  ai_classification,
  confidence_score,
  processing_time_ms,
  created_at
FROM ai_audit_trail
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check immutable audit vault
SELECT id, actor_bsuid, action_taken, model_version, created_at
FROM audit_vault
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check if Jira task was routed
SELECT *
FROM pm_project_routing
ORDER BY created_at DESC
LIMIT 5;

-- 6. Check intake logs (sender only)
SELECT sender_id, message_body, created_at
FROM intake_logs
ORDER BY created_at DESC
LIMIT 5;

-- Onboarding: Add Teams user subscription (run once per new user)
/*
INSERT INTO subscriptions (teams_user_id, plan_type)
VALUES ('<teams_user_id>', 'pilot');

SELECT * FROM subscriptions;
*/
