import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { updateTierConfig } from './actions';
import { logoutAdmin } from '../login/actions';

export default async function AdminSettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;

  if (!token) redirect('/admin/login');

  // Verify token and check admin role
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

  const { data: tiers } = await supabase
    .from('plan_tiers')
    .select(`
      id,
      plan_type,
      config_settings (*)
    `)
    .order('plan_type');

  const inputClass = "w-full bg-[#0d0d0d] border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00d4a1] transition-colors";
  const labelClass = "text-xs font-semibold text-zinc-400 uppercase tracking-wider";

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
              <a href="/admin/settings" className="text-sm text-white bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg">
                Governance
              </a>
              <a href="/dashboard" className="text-sm text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                Ontology
              </a>
            </nav>
          </div>
          <form action={logoutAdmin}>
            <button type="submit" className="text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg px-4 py-2 transition-colors">
              Sign Out
            </button>
          </form>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tiers?.map((tier) => {
            const cfg = Array.isArray(tier.config_settings) ? tier.config_settings[0] : tier.config_settings;
            return (
              <div key={tier.id} className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden">

                <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00d4a1]" />
                    <h2 className="font-semibold text-white uppercase tracking-wider text-sm">
                      {tier.plan_type} Tier
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-zinc-600">{tier.id.slice(0, 8)}</span>
                </div>

                <form action={updateTierConfig} className="p-6 space-y-4">
                  <input type="hidden" name="tierId" value={cfg?.id} />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Max Input (Chars)</label>
                      <input name="max_input_chars" type="number" defaultValue={cfg?.max_input_chars} className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Max Output (Tokens)</label>
                      <input name="max_output_tokens" type="number" defaultValue={cfg?.max_output_tokens} className={inputClass} />
                    </div>

                    <div className="space-y-1.5">
                      <label className={labelClass}>Provider</label>
                      <select name="model_provider" defaultValue={cfg?.model_provider} className={inputClass}>
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="google">Google (Gemini)</option>
                        <option value="ollama">Ollama (Local GPU)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Temperature</label>
                      <input name="temperature" type="number" step="0.1" min="0" max="1" defaultValue={cfg?.temperature} className={inputClass} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Model Name</label>
                    <input name="model_name" type="text" defaultValue={cfg?.model_name} className={`${inputClass} font-mono`} />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>System Prompt</label>
                    <textarea name="system_prompt" rows={3} defaultValue={cfg?.system_prompt} className={`${inputClass} resize-none`} />
                  </div>

                  <div className="flex gap-6 pt-1">
                    <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                      <input type="checkbox" name="can_access_kb" value="true" defaultChecked={cfg?.can_access_kb}
                        className="accent-[#00d4a1]" />
                      Knowledge Base
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                      <input type="checkbox" name="enable_history" value="true" defaultChecked={cfg?.enable_history}
                        className="accent-[#00d4a1]" />
                      Chat History
                    </label>
                  </div>

                  <button type="submit" className="w-full bg-[#00d4a1] hover:bg-[#00bfa0] text-black font-semibold py-2.5 rounded-lg transition-colors">
                    Save {tier.plan_type} Config
                  </button>
                </form>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
