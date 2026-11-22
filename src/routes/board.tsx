import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "@/components/t4g/shell";
import { useProfile } from "@/lib/session";

export const Route = createFileRoute("/board")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Transact4Good" },
      { name: "description", content: "Anonymous givers ranked by points earned paying essential bills." },
      { property: "og:title", content: "Leaderboard — Transact4Good" },
      { property: "og:description", content: "Anonymous givers ranked by points earned paying essential bills." },
    ],
  }),
  component: Board,
});

function Board() {
  const { profile } = useProfile();
  const q = useQuery({
    queryKey: ["board"],
    queryFn: async () => (await supabase.from("profiles").select("id, alias, city, points").eq("role", "payer").order("points", { ascending: false }).limit(50)).data ?? [],
  });
  if (!profile) return null;
  return (
    <Shell role={profile.role as "payer" | "recipient"} title="Leaderboard">
      <p className="-mt-2 mb-5 text-sm text-muted-foreground">1 point per dollar that reaches a biller. Names stay hidden.</p>
      <ol className="space-y-2">
        {(q.data ?? []).map((p, i) => (
          <li key={p.id} className={`flex items-center gap-4 rounded-2xl px-4 py-4 ${p.id === profile.id ? "bg-foreground text-background" : "bg-card shadow-card"}`}>
            <span className="w-8 font-mono text-lg font-semibold">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
            <div className="flex-1"><div className="font-bold">{p.alias}{p.id === profile.id && " (you)"}</div><div className="text-xs opacity-60">{p.city}</div></div>
            <span className="font-mono font-semibold">{p.points}</span>
          </li>
        ))}
      </ol>
    </Shell>
  );
}
