import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="max-w-2xl w-full mx-auto px-6 py-16 text-center">
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Property Manager
          </h1>
          <p className="text-slate-400 text-xl leading-relaxed">
            A modern platform for managing properties, tenants, and maintenance
            requests with ease.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-blue-500 transition-colors duration-200">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Property Manager
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                Manage properties, units, tenants, and maintenance requests from
                a central dashboard.
              </p>
            </div>
            <Link
              href="/manager/login"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 text-center"
            >
              Manager Login
            </Link>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-emerald-500 transition-colors duration-200">
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Tenant</h2>
              <p className="text-slate-400 text-sm mb-6">
                View your lease, submit maintenance requests, and communicate
                with your property manager.
              </p>
            </div>
            <Link
              href="/tenant/login"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 text-center"
            >
              Tenant Login
            </Link>
          </div>
        </div>

        <p className="mt-12 text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} Property Manager. All rights
          reserved.
        </p>
      </div>
    </main>
  );
}
