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
    }
  }, [user, role, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user || role === "athlete") return null;

  return (
    <div className="min-h-screen bg-slate-900">
      <main className="max-w-lg mx-auto pb-nav">{children}</main>
      <BottomNav />
    </div>
  );
}
