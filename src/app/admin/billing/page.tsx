import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logoutAdmin } from '../login/actions';
import { GenerateLinkForm } from './GenerateLinkForm';

export default async function AdminBillingPage() {
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

  // Fetch subscriptions joined with waitlist (email) + system_status
  const { data: rows } = await supabase
    .from('subscriptions')
    .select(`
      id,
      plan_type,
      external_customer_id,
      external_subscription_id,
      system_status ( label ),
      waitlist ( email, first_name, last_name )
    `)
    .order('created_at', { ascending: false });

  const subscribers = (rows ?? []).map((r: any) => ({
    id: r.id as string,
    email: r.waitlist?.email ?? '',
    name: [r.waitlist?.first_name, r.waitlist?.last_name].filter(Boolean).join(' ') || r.waitlist?.email || '—',
    plan_type: r.plan_type as string,
    status_label: r.system_status?.label ?? null,
    external_subscription_id: r.external_subscription_id ?? null,
    external_customer_id: r.external_customer_id ?? null,
  }));

  return (
    <div className="min-h-screen bg-[#0d0d0d] p-8">
      <div className="max-w-6xl mx-auto">

        <header className="mb-8 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[#00d4a1] font-bold text-lg tracking-tight">pmu</span>
              <span className="text-white font-bold text-lg tracking-tight">.sg</span>
            </div>
            <nav className="flex items-center gap-1 mt-2">
              <a href="/admin/settings" className="text-sm text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                Governance
              </a>
              <a href="/admin/dashboard" className="text-sm text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                Ontology
              </a>
              <a href="/admin/billing" className="text-sm text-white bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg">
                Billing
              </a>
            </nav>
          </div>
          <form action={logoutAdmin}>
            <button type="submit" className="text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg px-4 py-2 transition-colors">
              Sign Out
            </button>
          </form>
        </header>

        <GenerateLinkForm subscribers={subscribers} />

      </div>
    </div>
  );
}
