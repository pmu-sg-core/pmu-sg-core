import { supabase } from '@/lib/supabase';
import { JiraAdapter } from './jira';
import type { WorkItem, PMAdapter } from './types';

// Registry of available adapters
const adapters: Record<string, PMAdapter> = {
  jira: new JiraAdapter(),
  // monday: new MondayAdapter(),
  // asana: new AsanaAdapter(),
  // trello: new TrelloAdapter(),
};

// Look up routing config from pm_project_routing, then dispatch to the right adapter
export async function routeWorkItem(item: Omit<WorkItem, 'platform' | 'projectKey' | 'createdAt'>): Promise<WorkItem | null> {
  const { data: route } = await supabase
    .from('pm_project_routing')
    .select('pm_tool, pm_project_key, priority_level')
    .eq('category_name', item.category ?? '')
    .eq('is_active', true)
    .single();

  if (!route) return null;

  const adapter = adapters[route.pm_tool];
  if (!adapter) return null;

  const workItem: WorkItem = {
    ...item,
    platform: route.pm_tool,
    projectKey: route.pm_project_key,
    priority: (route.priority_level as WorkItem['priority']) ?? 'Medium',
    createdAt: new Date().toISOString(),
  };

  return adapter.createWorkItem(workItem);
}
