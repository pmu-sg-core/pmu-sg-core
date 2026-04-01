-- Function to generate a transaction hash for the Audit Vault
CREATE OR REPLACE FUNCTION generate_audit_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hash_signature := encode(digest(
    NEW.actor_bsuid || 
    NEW.reasoning_trace::text || 
    NEW.created_at::text, 
    'sha256'
  ), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_hashing
BEFORE INSERT ON audit_vault
FOR EACH ROW EXECUTE FUNCTION generate_audit_hash();



CREATE VIEW active_pipeline_status AS
SELECT 
  org_id,
  COUNT(*) FILTER (WHERE status = 'pending') as queued_tasks,
  COUNT(*) FILTER (WHERE status = 'failed') as blocked_tasks
FROM pending_actions_queue
GROUP BY org_id;