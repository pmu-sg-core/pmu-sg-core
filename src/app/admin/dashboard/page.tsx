import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logoutAdmin } from '../login/actions';
import OntologyDashboard from './OntologyDashboard';

export default async function OntologyPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;
  if (!token) redirect('/admin/login');

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await authClient.auth.getUser(token);
  if (!user) redirect('/admin/login');

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  if (roleData?.role !== 'admin') redirect('/admin/login');

  const [intentRes, dailyRes, actorRes, modelRes, functionsRes] = await Promise.all([
    supabase.from('vw_intent_distribution').select('*'),
    supabase.from('vw_daily_metrics').select('*').limit(30),
    supabase.from('vw_actor_activity').select('*'),
    supabase.from('vw_ai_model_health').select('*'),
    supabase.from('business_functions').select('code, name, is_active').order('name'),
  ]);

  return (
    <div className="min-h-screen bg-[#0d0d0d]">

      {/* Top nav */}
      <div className="border-b border-zinc-800 px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[#00d4a1] font-bold text-lg tracking-tight">pmu</span>
              <span className="text-white font-bold text-lg tracking-tight">.sg</span>
            </div>
            <nav className="flex items-center gap-1">
              <a
                href="/admin/settings"
                className="text-sm text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Governance
              </a>
              <a
                href="/admin/dashboard"
                className="text-sm text-white bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg"
              >
                Ontology
              </a>
              <a
                href="/admin/billing"
                className="text-sm text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Billing
              </a>
            </nav>
          </div>
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg px-4 py-2 transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>

      {/* Page header */}
      <div className="max-w-7xl mx-auto px-8 pt-8 pb-2">
        <h1 className="text-2xl font-bold text-white">Ontology Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Message pipeline analytics across business functions, channels, and plan tiers.
        </p>
      </div>

      <OntologyDashboard
        intentData={intentRes.data ?? []}
        dailyData={dailyRes.data ?? []}
        actorData={actorRes.data ?? []}
        modelData={modelRes.data ?? []}
        businessFunctions={functionsRes.data ?? []}
      />
    </div>
  );
}
