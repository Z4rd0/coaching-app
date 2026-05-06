"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AthleteBottomNav from "@/components/AthleteBottomNav";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function AthleteLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth");
    } else if (role === "coach") {
      router.replace("/dashboard");
    }
  }, [user, role, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user || role === "coach") return null;

  return (
    <div className="min-h-screen bg-slate-900">
      <main className="max-w-lg mx-auto pb-nav">{children}</main>
      <AthleteBottomNav />
    </div>
  );
}
