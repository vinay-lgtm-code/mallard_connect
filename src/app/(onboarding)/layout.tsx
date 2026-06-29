import Link from "next/link";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <span className="text-lg font-bold text-text-primary">Sequence</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-text-secondary hover:text-text-primary">
            Already have an account? Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
