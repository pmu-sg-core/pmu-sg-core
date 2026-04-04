'use client';

import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntentRow {
  intent: string | null;
  plan_type: string | null;
  platform: string | null;
  message_count: number;
  avg_confidence: number | null;
  avg_latency_ms: number | null;
  routed_to_pm: number;
}

interface DailyRow {
  day: string;
  messages_received: number;
  tickets_created: number;
  delivery_failures: number;
  avg_confidence: number | null;
  avg_latency_ms: number | null;
  peak_latency_ms: number | null;
  whatsapp_msgs: number;
  teams_msgs: number;
  pilot_users: number;
  lite_users: number;
  pro_users: number;
  corporate_users: number;
}

interface ActorRow {
  sender_id: string;
  actor_identifier: string | null;
  plan_type: string | null;
  total_messages: number;
  tickets_created: number;
  avg_confidence: number | null;
  avg_processing_ms: number | null;
  last_seen_at: string | null;
  dominant_intent: string | null;
  whatsapp_count: number;
  teams_count: number;
}

interface ModelRow {
  model_version: string | null;
  day: string;
  decisions_made: number;
  avg_confidence: number | null;
  avg_latency_ms: number | null;
  low_confidence_count: number;
  out_of_scope_count: number;
}

interface BusinessFunction {
  code: string;
  name: string;
  is_active: boolean;
}

interface Props {
  intentData: IntentRow[];
  dailyData: DailyRow[];
  actorData: ActorRow[];
  modelData: ModelRow[];
  businessFunctions: BusinessFunction[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const INTENT_COLORS = ['#00d4a1', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];

const PLAN_COLORS: Record<string, string> = {
  pilot: '#00d4a1',
  lite: '#3b82f6',
  pro: '#f59e0b',
  corporate: '#8b5cf6',
  unknown: '#52525b',
};

const PLATFORM_COLORS: Record<string, string> = {
  whatsapp: '#00d4a1',
  teams: '#3b82f6',
};

// ── Tooltip ───────────────────────────────────────────────────────────────────

const DarkTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-zinc-400 mb-1.5 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-zinc-400">{p.name}:</span>
          <span className="text-white font-semibold">{typeof p.value === 'number' && p.value % 1 !== 0 ? p.value.toFixed(3) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { pct: string } }[];
}) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-[#111] border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-white font-semibold">{item.name}</p>
      <p className="text-zinc-400">{item.value} messages <span className="text-[#00d4a1]">({item.payload.pct})</span></p>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-[#00d4a1] flex-shrink-0" />
      <div>
        <h3 className="text-sm font-semibold text-white tracking-wide">{title}</h3>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl px-5 py-4">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[240px]">
      <p className="text-zinc-600 text-sm">{message}</p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex items-center justify-center h-[240px]">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-[#00d4a1] rounded-full animate-spin" />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function OntologyDashboard({ intentData, dailyData, actorData, modelData, businessFunctions }: Props) {
  const [mounted, setMounted] = useState(false);
  const [selectedFn, setSelectedFn] = useState('all');

  useEffect(() => { setMounted(true); }, []);

  // ── Filter intent data by selected business function ──────────────────────
  const filteredIntents = intentData.filter(d =>
    selectedFn === 'all' || d.intent?.startsWith(selectedFn + '.')
  );

  // ── KPI derivations ───────────────────────────────────────────────────────
  const totalMessages = filteredIntents.reduce((s, d) => s + (d.message_count || 0), 0);
  const totalTickets  = filteredIntents.reduce((s, d) => s + (d.routed_to_pm || 0), 0);

  const weightedConf = filteredIntents.reduce((s, d) =>
    d.avg_confidence != null ? s + d.avg_confidence * d.message_count : s, 0);
  const avgConfidence = totalMessages > 0
    ? (weightedConf / totalMessages * 100).toFixed(1)
    : '—';

  const latencies = filteredIntents
    .map(d => d.avg_latency_ms)
    .filter((v): v is number => v != null);
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
    : null;

  // ── Intent pie data ───────────────────────────────────────────────────────
  const intentAgg = filteredIntents.reduce((acc, d) => {
    const key = d.intent ?? 'unknown';
    acc[key] = (acc[key] || 0) + d.message_count;
    return acc;
  }, {} as Record<string, number>);

  const intentTotal = Object.values(intentAgg).reduce((s, v) => s + v, 0);
  const intentPieData = Object.entries(intentAgg)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name: name.split('.').slice(1).join('.') || name,
      fullName: name,
      value,
      pct: intentTotal > 0 ? ((value / intentTotal) * 100).toFixed(1) + '%' : '0%',
    }));

  // ── Plan tier pie data ────────────────────────────────────────────────────
  const planAgg = actorData.reduce((acc, d) => {
    const tier = d.plan_type ?? 'unknown';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const planTotal = Object.values(planAgg).reduce((s, v) => s + v, 0);
  const planPieData = Object.entries(planAgg)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      pct: planTotal > 0 ? ((value / planTotal) * 100).toFixed(1) + '%' : '0%',
    }));

  // ── Daily volume bar data (last 14 days, chronological) ──────────────────
  const dailyBarData = [...dailyData]
    .slice(0, 14)
    .reverse()
    .map(d => ({
      ...d,
      day: new Date(d.day).toLocaleDateString('en-SG', { month: 'short', day: 'numeric' }),
    }));

  // ── Platform split bar data ───────────────────────────────────────────────
  const platformBarData = dailyBarData.map(d => ({
    day: d.day,
    WhatsApp: d.whatsapp_msgs || 0,
    Teams: d.teams_msgs || 0,
  }));

  // ── AI latency trend ──────────────────────────────────────────────────────
  const latencyBarData = dailyBarData.map(d => ({
    day: d.day,
    'Avg (ms)':  Math.round(d.avg_latency_ms  ?? 0),
    'Peak (ms)': Math.round(d.peak_latency_ms ?? 0),
  }));

  // ── Model health bar data ─────────────────────────────────────────────────
  const modelAgg = modelData.reduce((acc, d) => {
    const key = d.model_version ?? 'unknown';
    if (!acc[key]) acc[key] = { model: key, Decisions: 0, 'Low Confidence': 0, 'Out of Scope': 0 };
    acc[key].Decisions        += d.decisions_made       || 0;
    acc[key]['Low Confidence'] += d.low_confidence_count || 0;
    acc[key]['Out of Scope']   += d.out_of_scope_count   || 0;
    return acc;
  }, {} as Record<string, { model: string; Decisions: number; 'Low Confidence': number; 'Out of Scope': number }>);

  const modelBarData = Object.values(modelAgg);

  // ── Top actors ────────────────────────────────────────────────────────────
  const topActors = [...actorData]
    .sort((a, b) => (b.total_messages || 0) - (a.total_messages || 0))
    .slice(0, 5);

  // ── Axis / grid styles ────────────────────────────────────────────────────
  const axisStyle   = { fill: '#71717a', fontSize: 11 };
  const gridStyle   = { stroke: '#27272a' };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">

      {/* Business Function Filter */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">
          Business Function
        </label>
        <select
          value={selectedFn}
          onChange={e => setSelectedFn(e.target.value)}
          className="bg-[#1a1a1a] border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00d4a1] transition-colors"
        >
          <option value="all">All Functions</option>
          {businessFunctions.map(fn => (
            <option key={fn.code} value={fn.code}>
              {fn.name}{fn.is_active ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
        {selectedFn !== 'all' && (
          <button
            onClick={() => setSelectedFn('all')}
            className="text-xs text-zinc-500 hover:text-[#00d4a1] transition-colors"
          >
            ✕ clear
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Messages"
          value={totalMessages.toLocaleString()}
          sub={selectedFn === 'all' ? 'all functions' : selectedFn}
        />
        <KpiCard
          label="Tickets Routed"
          value={totalTickets.toLocaleString()}
          sub={totalMessages > 0 ? `${((totalTickets / totalMessages) * 100).toFixed(1)}% routing rate` : '—'}
        />
        <KpiCard
          label="Avg AI Confidence"
          value={avgConfidence !== '—' ? `${avgConfidence}%` : '—'}
          sub="weighted by volume"
        />
        <KpiCard
          label="Avg Latency"
          value={avgLatency != null ? `${avgLatency.toLocaleString()} ms` : '—'}
          sub="AI processing time"
        />
      </div>

      {/* Row 1 — Intent & Plan Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Intent Distribution Pie */}
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden">
          <CardHeader
            title="Intent Distribution"
            subtitle={selectedFn === 'all' ? 'All business functions' : businessFunctions.find(f => f.code === selectedFn)?.name}
          />
          <div className="p-4">
            {!mounted ? <ChartSkeleton /> : intentPieData.length === 0 ? (
              <EmptyState message="No intent data for this function" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={intentPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {intentPieData.map((_, i) => (
                      <Cell key={i} fill={INTENT_COLORS[i % INTENT_COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    formatter={(value) => <span style={{ color: '#a1a1aa', fontSize: 11 }}>{value}</span>}
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Plan Tier Distribution Pie */}
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden">
          <CardHeader
            title="Plan Tier Distribution"
            subtitle="Active subscribers by tier"
          />
          <div className="p-4">
            {!mounted ? <ChartSkeleton /> : planPieData.length === 0 ? (
              <EmptyState message="No subscriber data available" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={planPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {planPieData.map((entry, i) => (
                      <Cell key={i} fill={PLAN_COLORS[entry.name] ?? INTENT_COLORS[i % INTENT_COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    formatter={(value) => <span style={{ color: '#a1a1aa', fontSize: 11 }}>{value}</span>}
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Row 2 — Volume & Platform Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Daily Message Volume */}
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden">
          <CardHeader title="Daily Message Volume" subtitle="Last 14 days" />
          <div className="p-4">
            {!mounted ? <ChartSkeleton /> : dailyBarData.length === 0 ? (
              <EmptyState message="No daily metrics available" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyBarData} barSize={16}>
                  <CartesianGrid vertical={false} stroke={gridStyle.stroke} />
                  <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<DarkTooltip />} cursor={{ fill: '#27272a' }} />
                  <Bar dataKey="messages_received" name="Messages" fill="#00d4a1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="tickets_created"   name="Tickets"  fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Platform Split */}
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden">
          <CardHeader title="Platform Split" subtitle="WhatsApp vs Teams per day" />
          <div className="p-4">
            {!mounted ? <ChartSkeleton /> : platformBarData.length === 0 ? (
              <EmptyState message="No platform data available" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={platformBarData} barSize={16}>
                  <CartesianGrid vertical={false} stroke={gridStyle.stroke} />
                  <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<DarkTooltip />} cursor={{ fill: '#27272a' }} />
                  <Legend formatter={(v) => <span style={{ color: '#a1a1aa', fontSize: 11 }}>{v}</span>} iconSize={8} />
                  <Bar dataKey="WhatsApp" fill={PLATFORM_COLORS.whatsapp} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Teams"    fill={PLATFORM_COLORS.teams}    radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Row 3 — AI Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* AI Latency Trend */}
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden">
          <CardHeader title="AI Latency Trend" subtitle="Avg and peak processing time (ms)" />
          <div className="p-4">
            {!mounted ? <ChartSkeleton /> : latencyBarData.length === 0 ? (
              <EmptyState message="No latency data available" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={latencyBarData} barSize={14}>
                  <CartesianGrid vertical={false} stroke={gridStyle.stroke} />
                  <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<DarkTooltip />} cursor={{ fill: '#27272a' }} />
                  <Legend formatter={(v) => <span style={{ color: '#a1a1aa', fontSize: 11 }}>{v}</span>} iconSize={8} />
                  <Bar dataKey="Avg (ms)"  fill="#00d4a1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Peak (ms)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Model Health */}
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden">
          <CardHeader title="AI Model Health" subtitle="Decisions, low confidence, and out-of-scope by model" />
          <div className="p-4">
            {!mounted ? <ChartSkeleton /> : modelBarData.length === 0 ? (
              <EmptyState message="No model audit data available" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={modelBarData} barSize={14}>
                  <CartesianGrid vertical={false} stroke={gridStyle.stroke} />
                  <XAxis
                    dataKey="model"
                    tick={{ ...axisStyle, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => v.length > 18 ? v.slice(0, 18) + '…' : v}
                  />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<DarkTooltip />} cursor={{ fill: '#27272a' }} />
                  <Legend formatter={(v) => <span style={{ color: '#a1a1aa', fontSize: 11 }}>{v}</span>} iconSize={8} />
                  <Bar dataKey="Decisions"        fill="#00d4a1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Low Confidence"   fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Out of Scope"     fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Row 4 — Top Actors */}
      <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden">
        <CardHeader title="Top Active Senders" subtitle="Ranked by message volume" />
        <div className="divide-y divide-zinc-800">
          {topActors.length === 0 ? (
            <EmptyState message="No actor data available" />
          ) : topActors.map((actor, i) => (
            <div key={actor.sender_id} className="px-5 py-3.5 flex items-center gap-4">
              {/* Rank */}
              <span className="text-xs font-mono text-zinc-600 w-4 flex-shrink-0">{i + 1}</span>

              {/* Identity */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-mono truncate">
                  {actor.actor_identifier ?? actor.sender_id}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {actor.dominant_intent ?? '—'} · last seen {actor.last_seen_at
                    ? new Date(actor.last_seen_at).toLocaleDateString('en-SG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-5 flex-shrink-0 text-right">
                <div>
                  <p className="text-sm font-semibold text-white">{actor.total_messages}</p>
                  <p className="text-xs text-zinc-500">msgs</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{actor.tickets_created}</p>
                  <p className="text-xs text-zinc-500">tickets</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {actor.avg_confidence != null ? `${(actor.avg_confidence * 100).toFixed(0)}%` : '—'}
                  </p>
                  <p className="text-xs text-zinc-500">conf.</p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`
                    text-xs font-semibold px-2 py-0.5 rounded-full
                    ${actor.plan_type === 'corporate' ? 'bg-purple-500/10 text-purple-400' :
                      actor.plan_type === 'pro'       ? 'bg-amber-500/10  text-amber-400'  :
                      actor.plan_type === 'lite'      ? 'bg-blue-500/10   text-blue-400'   :
                                                        'bg-teal-500/10   text-[#00d4a1]'  }
                  `}>
                    {actor.plan_type ?? 'unknown'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
