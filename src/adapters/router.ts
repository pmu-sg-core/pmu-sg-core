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
  const { data: route, error: routeError } = await supabase
    .from('pm_project_routing')
    .select('pm_tool, pm_project_key, priority_level')
    .eq('category_name', item.category ?? '')
    .eq('is_active', true)
    .single();

  if (routeError || !route) {
    console.error('[Router] No routing rule found for category:', item.category, routeError?.message);
    return null;
  }

  const adapter = adapters[route.pm_tool];
  if (!adapter) {
    console.error('[Router] No adapter registered for pm_tool:', route.pm_tool);
    return null;
  }

  const workItem: WorkItem = {
    ...item,
    platform: route.pm_tool,
    projectKey: route.pm_project_key,
    priority: (route.priority_level as WorkItem['priority']) ?? 'Medium',
    createdAt: new Date().toISOString(),
  };

  console.log('[Router] Creating work item in', route.pm_tool, '/', route.pm_project_key, 'for category:', item.category);
  const result = await adapter.createWorkItem(workItem);
  console.log('[Router] Work item created:', result?.externalKey);
  return result;
}
