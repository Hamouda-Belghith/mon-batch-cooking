"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { signInLocal, signUpLocal } from "@/features/auth/localAuth";
import { isDemoMode } from "@/lib/localDemo";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const supabase = getSupabase();
  const demo = isDemoMode();
  const showConfigWarning = !supabase && !demo;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSending(true);

    try {
      if (demo) {
        if (mode === "signin") {
          const { data, error } = await signInLocal(email.trim(), password);
          if (error) {
            setError(error.message);
          } else if (data?.session) {
            await router.replace("/");
          }
        } else {
          const { data, error } = await signUpLocal(email.trim(), password);
          if (error) {
            setError(error.message);
          } else if (data?.session) {
            await router.replace("/");
          }
        }

        return;
      }

      if (!supabase) {
        setError(
          "Supabase n'est pas configuré (variables d'environnement manquantes)."
        );
        return;
      }

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setError(error.message);
        } else {
          await router.replace("/");
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          setError(error.message);
        } else if (data.session) {
          await router.replace("/");
        } else {
          setMessage(
            "Compte créé. Vérifie ton email pour confirmer l'inscription, puis connecte-toi."
          );
          setMode("signin");
        }
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <p className="brand login-brand">Meal Planner</p>
        <h1 className="login-title">
          {mode === "signin" ? "Qu'est-ce qu'on mange cette semaine ?" : "Créer un compte"}
        </h1>
        <p className="page-sub">Planning des repas et liste de courses, à deux.</p>

        {showConfigWarning ? (
          <div className="notice notice-warn">
            <div>
              <strong>Configuration manquante.</strong> Les variables{" "}
              <code>NEXT_PUBLIC_SUPABASE_URL</code> et <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
              ne sont pas définies. Copie <code>.env.local.example</code> vers{" "}
              <code>.env.local</code> et renseigne les valeurs de ton projet Supabase.
            </div>
          </div>
        ) : (
          <>
            {demo ? (
              <div className="notice notice-info">
                <div>
                  <strong>Mode démo.</strong> Les données restent dans ce navigateur, sans
                  Supabase.
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="login-form">
              <Field
                label="Email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.fr"
              />
              <Field
                label="Mot de passe"
                name="password"
                type="password"
                required
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error ? (
                <div className="notice notice-error" role="alert">
                  {error}
                </div>
              ) : null}
              {message ? (
                <p className="status-ok" role="status">
                  {message}
                </p>
              ) : null}

              <Button type="submit" disabled={sending} className="btn-block btn-lg">
                {sending
                  ? mode === "signin"
                    ? "Connexion…"
                    : "Création…"
                  : mode === "signin"
                    ? "Se connecter"
                    : "Créer le compte"}
              </Button>
            </form>
          </>
        )}

        <p className="login-switch">
          {mode === "signin" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
          >
            {mode === "signin" ? "Créer un compte" : "Se connecter"}
          </button>
        </p>
      </div>
    </div>
  );
}
