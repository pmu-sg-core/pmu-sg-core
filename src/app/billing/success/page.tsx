export default function BillingSuccessPage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-full bg-[#00d4a1]/10 border border-[#00d4a1]/30 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-[#00d4a1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">You&apos;re all set</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Your subscription is now active. The team will be in touch shortly to complete your onboarding.
        </p>
        <p className="mt-6 text-xs text-zinc-600">pmu.sg</p>
      </div>
    </div>
  );
}
