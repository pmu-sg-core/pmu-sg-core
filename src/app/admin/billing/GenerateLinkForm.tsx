'use client';

import { useState } from 'react';

interface Subscriber {
  id: string;
  email: string;
  name: string;
  plan_type: string;
  status_label: string | null;
  external_subscription_id: string | null;
  external_customer_id: string | null;
}

export function GenerateLinkForm({ subscribers }: { subscribers: Subscriber[] }) {
  const [selectedId, setSelectedId] = useState('');
  const [plan, setPlan] = useState('lite');
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = subscribers.find(s => s.id === selectedId);

  async function handleGenerate() {
    if (!selectedId || !selected) return;
    setLoading(true);
    setCheckoutUrl(null);
    setError(null);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: selectedId,
          plan,
          email: selected.email,
          name: selected.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unknown error');
      setCheckoutUrl(data.url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePortal(subscriptionId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unknown error');
      window.open(data.url, '_blank');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-[#0d0d0d] border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00d4a1] transition-colors";
  const labelClass = "text-xs font-semibold text-zinc-400 uppercase tracking-wider";

  return (
    <div className="space-y-8">

      {/* Generate checkout link */}
      <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Generate Checkout Link</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Subscriber</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputClass}>
              <option value="">— Select subscriber —</option>
              {subscribers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Plan</label>
            <select value={plan} onChange={e => setPlan(e.target.value)} className={inputClass}>
              <option value="lite">Lite</option>
              <option value="pro">Pro</option>
              <option value="corporate">Corporate</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!selectedId || loading}
          className="bg-[#00d4a1] hover:bg-[#00bfa0] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold py-2.5 px-6 rounded-lg transition-colors text-sm"
        >
          {loading ? 'Generating...' : 'Generate Link'}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {checkoutUrl && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Checkout URL — copy and send to subscriber</p>
            <div className="flex items-center gap-2">
              <input readOnly value={checkoutUrl} className={`${inputClass} font-mono text-xs`} onClick={e => (e.target as HTMLInputElement).select()} />
              <button
                onClick={() => navigator.clipboard.writeText(checkoutUrl)}
                className="shrink-0 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-xs px-3 py-2 rounded-lg transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subscriber list */}
      <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">All Subscribers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Name / Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Plan</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Stripe</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {subscribers.map(s => (
                <tr key={s.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-white font-medium">{s.name}</div>
                    <div className="text-zinc-500 text-xs">{s.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                      {s.plan_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      s.status_label === 'Active'     ? 'bg-[#00d4a1]/10 text-[#00d4a1]' :
                      s.status_label === 'Trialing'   ? 'bg-blue-500/10 text-blue-400' :
                      s.status_label === 'Suspended'  ? 'bg-yellow-500/10 text-yellow-400' :
                      s.status_label === 'Cancelled'  ? 'bg-red-500/10 text-red-400' :
                                                        'bg-zinc-800 text-zinc-400'
                    }`}>
                      {s.status_label ?? 'No status'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-500 font-mono">
                    {s.external_subscription_id ? s.external_subscription_id.slice(0, 16) + '…' : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {s.external_customer_id && (
                      <button
                        onClick={() => handlePortal(s.id)}
                        disabled={loading}
                        className="text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                      >
                        Manage
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {subscribers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-600 text-sm">No subscribers yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
