"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth");
    } else if (role === "athlete") {
      router.replace("/athlete/dashboard");
    } else if (role === null) {
      // Authenticated but no coach profile yet — finish onboarding first.
      router.replace("/onboarding");
    }
  }, [user, role, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <LoadingSpinner />
      </div>
    );
  }

  // Only render the coach shell once we know they're a coach; otherwise a
  // redirect (to /auth, /athlete/dashboard or /onboarding) is in flight.
  if (role !== "coach") return null;

  return (
    <div className="min-h-screen bg-surface-base">
      <main className="max-w-lg mx-auto pb-nav">{children}</main>
      <BottomNav />
    </div>
  );
}
