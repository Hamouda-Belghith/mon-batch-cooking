"use client";

import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/features/auth/AuthContext";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { setupAutoSync } from "@/features/shopping-list/syncQueue";
import { FeedbackProvider } from "@/components/ui/Feedback";
import { Spinner } from "@/components/ui/Spinner";
import { Nav } from "./nav";

function AppGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  // Rejoue les mutations offline dès que le réseau revient.
  useEffect(() => setupAutoSync(), []);

  if (loading) {
    return (
      <div className="fullscreen-center">
        <Spinner label="Connexion…" />
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return (
    <>
      <Nav />
      <main className="container">{children}</main>
    </>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FeedbackProvider>
        <AppGate>{children}</AppGate>
      </FeedbackProvider>
    </AuthProvider>
  );
}
