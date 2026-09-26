import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — sha256 challenger" },
      { name: "description", content: "Choose a new password for your miner account." },
      { property: "og:title", content: "Set a new password" },
      { property: "og:description", content: "Choose a new password for your miner account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  return (
    <main className="grid-lines flex min-h-screen items-center justify-center px-4">
      <form
        className="panel w-full max-w-sm space-y-4 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.auth.updateUser({ password });
          if (error) return toast.error(error.message);
          toast.success("Password updated");
          navigate({ to: "/" });
        }}
      >
        <h1 className="text-xl font-bold lowercase">new password</h1>
        <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="hash-text w-full">Save</Button>
      </form>
    </main>
  );
}
