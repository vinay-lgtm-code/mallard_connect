import Link from "next/link";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <span className="text-lg font-bold text-gray-900">Sequence</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">
            Already have an account? Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
