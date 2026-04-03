import { loginAdmin } from './actions';

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="text-[#00d4a1] font-bold text-xl tracking-tight">pmu</span>
            <span className="text-white font-bold text-xl tracking-tight">.sg</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-sm text-zinc-500 mt-1">Sign in to access the Governance Hub</p>
        </div>

        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-8">
          <form action={loginAdmin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="admin@pmu.sg"
                className="w-full bg-[#0d0d0d] border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00d4a1] transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
              <input
                name="password"
                type="password"
                required
                placeholder="Enter admin password"
                className="w-full bg-[#0d0d0d] border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00d4a1] transition-colors"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#00d4a1] hover:bg-[#00bfa0] text-black font-semibold py-2.5 rounded-lg transition-colors mt-2"
            >
              Sign In
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
