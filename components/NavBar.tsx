"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function NavBar() {
  const { data: session, status } = useSession();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link
              href="/"
              className="text-xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              MyApp
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {status === "authenticated" && session?.user ? (
              <>
                <div className="flex items-center gap-2">
                  {session.user.name && (
                    <span className="text-sm text-gray-700 font-medium">
                      {session.user.name}
                    </span>
                  )}
                  {(session.user as { role?: string }).role && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 capitalize">
                      {(session.user as { role?: string }).role}
                    </span>
                  )}
                </div>

                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : status === "loading" ? (
              <div className="h-8 w-24 bg-gray-200 animate-pulse rounded-md" />
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
