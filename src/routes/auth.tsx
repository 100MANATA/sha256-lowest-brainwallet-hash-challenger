import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — sha256 lowest brainwallet hash challenger" },
      { name: "description", content: "Create a miner account to keep your verified SHA-256 records across devices." },
      { property: "og:title", content: "Sign in — sha256 challenger" },
      { property: "og:description", content: "Keep your verified records synced between phone and computer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset link sent");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid-lines flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="panel w-full max-w-sm space-y-4 p-6">
        <Link to="/" className="label-xs hover:text-primary">← back</Link>
        <h1 className="text-xl font-bold lowercase">
          {mode === "signin" ? "sign in" : mode === "signup" ? "create miner account" : "reset password"}
        </h1>
        <div>
          <Label htmlFor="email" className="label-xs">Email</Label>
          <Input id="email" type="email" required className="mt-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode !== "forgot" && (
          <div>
            <Label htmlFor="password" className="label-xs">Password</Label>
            <Input id="password" type="password" required minLength={6} className="mt-2" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        <Button type="submit" disabled={busy} className="hash-text w-full">
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Sign up" : "Send reset link"}
        </Button>
        <div className="flex justify-between text-xs text-muted-foreground">
          <button type="button" className="hover:text-primary" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
            {mode === "signup" ? "Have an account? Sign in" : "New? Create account"}
          </button>
          <button type="button" className="hover:text-primary" onClick={() => setMode("forgot")}>Forgot password?</button>
        </div>
      </form>
    </main>
  );
}
