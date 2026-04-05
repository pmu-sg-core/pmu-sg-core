import { supabase } from './supabase';

// ── Supabase return shape ─────────────────────────────────────────────────────

interface ConfigSettings {
  max_input_chars: number;
  max_output_tokens: number;
  model_provider: string;
  model_name: string;
  temperature: number;
  system_prompt: string;
  prompt_id: string;
  can_access_kb: boolean;
  enable_history: boolean;
  locale_hints: string | null;
}

interface SubscriptionRow {
  plan_type: string;
  plan_tiers: { config_settings: ConfigSettings | ConfigSettings[] }
            | { config_settings: ConfigSettings | ConfigSettings[] }[];
}

export interface AgentGovernance extends ConfigSettings {
  plan_type: string;
  can_assign_tickets: boolean;
  can_access_bca: boolean;
  site_project_id: string | null;   // active site project for BCA subscribers
  locale_hints: string | null;
}

export async function getAgentGovernance(
  identity: string,
  channel: 'whatsapp' | 'teams' = 'whatsapp',
): Promise<AgentGovernance | null> {
  const column = channel === 'teams' ? 'teams_user_id' : 'whatsapp_number';

  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      plan_type,
      plan_tiers!inner (
        config_settings (
          max_input_chars,
          max_output_tokens,
          model_provider,
          model_name,
          temperature,
          system_prompt,
          prompt_id,
          can_access_kb,
          enable_history,
          locale_hints
        )
      ),
      subscriber (
        sector_tags,
        site_projects ( id )
      )
    `)
    .eq(column, identity)
    .single();

  if (error || !data) return null;

  const row = data as unknown as SubscriptionRow & {
    subscriber?: { sector_tags: string[] | null; site_projects?: { id: string }[] } | null;
  };
  const tier = Array.isArray(row.plan_tiers) ? row.plan_tiers[0] : row.plan_tiers;
  const rawConfig = tier?.config_settings;
  const config: ConfigSettings | null = rawConfig
    ? (Array.isArray(rawConfig) ? rawConfig[0] : rawConfig) ?? null
    : null;

  if (!config) return null;

  const sectorTags = row.subscriber?.sector_tags ?? [];
  const siteProjects = row.subscriber?.site_projects ?? [];

  return {
    ...config,
    plan_type: row.plan_type,
    can_assign_tickets: false,
    can_access_bca: sectorTags.includes('bca'),
    site_project_id: siteProjects[0]?.id ?? null,
  };
}
