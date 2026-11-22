import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Shell, Progress, StatusPill } from "@/components/t4g/shell";
import { GiveSheet } from "@/components/t4g/give-sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loadBillsWithPeople, type LoadedBill } from "@/lib/data";
import { categoryMeta, ESSENTIALS, luhn, money } from "@/lib/rules";
import { useProfile } from "@/lib/session";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "My account — Transact4Good" },
      { name: "description", content: "Your bills, your giving and your verification, all anonymous." },
      { property: "og:title", content: "My account — Transact4Good" },
      { property: "og:description", content: "Your bills, your giving and your verification, all anonymous." },
    ],
  }),
  component: Me,
});

type Profile = NonNullable<ReturnType<typeof useProfile>["profile"]>;

function Me() {
  const { profile, loading } = useProfile();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !profile) nav({ to: "/" }); }, [loading, profile, nav]);
  if (!profile) return null;
  return profile.role === "payer" ? <PayerMe p={profile} /> : <RecipientMe p={profile} />;
}

function Verified({ p }: { p: Profile }) {
  const v = (p.verification ?? {}) as Record<string, string>;
  return (
    <div className="receipt p-5 pb-8">
      <div className="flex items-center justify-between">
        <div><div className="text-2xl font-extrabold">{p.alias}</div><div className="text-sm text-muted-foreground">{p.city}, {p.province}</div></div>
        <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-bold text-accent">Verified ✓</span>
      </div>
      <div className="dotted-rule my-4" />
      <div className="space-y-1.5 font-mono text-xs">
        {Object.entries(v).map(([k, val]) => (
          <div key={k} className="flex justify-between"><span className="uppercase text-muted-foreground">{k}</span><span>{val}</span></div>
        ))}
        {p.role === "recipient" && <div className="flex justify-between"><span className="uppercase text-muted-foreground">income</span><span>{money(Number(p.monthly_income))}/mo · {p.household_size} at home</span></div>}
      </div>
    </div>
  );
}

function RecipientMe({ p }: { p: Profile }) {
  const q = useQuery({ queryKey: ["bills"], queryFn: loadBillsWithPeople });
  const mine = (q.data ?? []).filter((b) => b.recipient_id === p.id).reverse();
  const covered = mine.reduce((s, b) => s + b.funded, 0);
  return (
    <Shell role="recipient" title="My bills">
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Stat k="Covered so far" v={money(covered)} />
        <Stat k="Times helped" v={String(mine[0]?.times_helped ?? 0)} />
      </div>
      <div className="space-y-3">
        {mine.map((b) => (
          <div key={b.id} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div className="font-bold">{categoryMeta(b.category).icon} {b.provider}</div>
              <StatusPill status={b.status} />
            </div>
            <div className="mt-2 flex items-baseline justify-between font-mono">
              <span className="text-lg font-semibold">{money(b.funded)}</span>
              <span className="text-xs text-muted-foreground">of {money(b.amount)} · due {b.due_date}</span>
            </div>
            <div className="mt-2"><Progress value={b.funded / b.amount} /></div>
            <div className="mt-2 font-mono text-[11px] text-muted-foreground">→ {b.payee_institution} · {b.payee_account}</div>
          </div>
        ))}
        <Link to="/new" className="block rounded-2xl border-2 border-dashed border-border py-5 text-center font-bold">+ Post a bill</Link>
      </div>
      <h2 className="mt-8 mb-3 text-lg font-bold">Your identity</h2>
      <Verified p={p} />
      <p className="mt-3 text-xs text-muted-foreground">Money never comes to you. It goes from the vault straight to your biller.</p>
    </Shell>
  );
}

function PayerMe({ p }: { p: Profile }) {
  const qc = useQueryClient();
  const [card, setCard] = useState("");
  const [giving, setGiving] = useState<LoadedBill | null>(null);
  const prefs = (p.preferences ?? {}) as { categories?: string[] };
  const bills = useQuery({ queryKey: ["bills"], queryFn: loadBillsWithPeople });
  const saves = useQuery({ queryKey: ["saves", p.id], queryFn: async () => (await supabase.from("saves").select("bill_id").eq("payer_id", p.id)).data ?? [] });
  const mine = useQuery({
    queryKey: ["my-payments", p.id],
    queryFn: async () => (await supabase.from("payments").select("id, amount, status, created_at, bill:bills!payments_bill_id_fkey(provider, category)").eq("payer_id", p.id).order("created_at", { ascending: false })).data ?? [],
  });
  const saved = (bills.data ?? []).filter((b) => saves.data?.some((s) => s.bill_id === b.id) && b.status === "open");
  const total = (mine.data ?? []).filter((x) => x.status !== "rejected").reduce((s, x) => s + Number(x.amount), 0);

  async function saveCard() {
    if (!luhn(card)) { toast.error("Card number not valid"); return; }
    await supabase.from("profiles").update({ card_last4: card.replace(/\D/g, "").slice(-4) }).eq("id", p.id);
    setCard("");
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Card saved");
  }
  async function toggleCat(id: string) {
    const cur = prefs.categories ?? [];
    const next = cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id];
    await supabase.from("profiles").update({ preferences: { ...(p.preferences as object), categories: next } }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <Shell role="payer" title="Me">
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Stat k="Given" v={money(total)} />
        <Stat k="Points" v={String(p.points)} />
      </div>

      <h2 className="mb-2 font-bold">Card</h2>
      {p.card_last4 ? (
        <div className="flex items-center justify-between rounded-2xl bg-foreground px-5 py-5 font-mono text-background">
          <span>•••• •••• •••• {p.card_last4}</span>
          <button className="text-xs underline" onClick={async () => { await supabase.from("profiles").update({ card_last4: null }).eq("id", p.id); qc.invalidateQueries({ queryKey: ["profile"] }); }}>remove</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input inputMode="numeric" placeholder="4242 4242 4242 4242" value={card} onChange={(e) => setCard(e.target.value)} className="h-12 rounded-xl font-mono" />
          <Button className="h-12 rounded-xl" onClick={saveCard}>Add</Button>
        </div>
      )}

      <h2 className="mt-7 mb-2 font-bold">Saved for later</h2>
      {saved.length === 0 ? <p className="text-sm text-muted-foreground">Swipe up on a bill to save it.</p> : (
        <div className="space-y-2">
          {saved.map((b) => (
            <button key={b.id} onClick={() => setGiving(b)} className="flex w-full items-center justify-between rounded-2xl bg-card p-4 text-left shadow-card">
              <span className="font-semibold">{categoryMeta(b.category).icon} {b.provider}</span>
              <span className="font-mono text-sm">{money(b.amount - b.funded)} left →</span>
            </button>
          ))}
        </div>
      )}

      <h2 className="mt-7 mb-2 font-bold">Your gifts</h2>
      <div className="space-y-2">
        {(mine.data ?? []).map((x) => (
          <div key={x.id} className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 shadow-card">
            <div><div className="font-semibold">{x.bill?.provider}</div><div className="font-mono text-xs text-muted-foreground">{money(Number(x.amount))}</div></div>
            <StatusPill status={x.status} />
          </div>
        ))}
        {mine.data?.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
      </div>

      <h2 className="mt-7 mb-2 font-bold">Show me more</h2>
      <div className="flex flex-wrap gap-2">
        {ESSENTIALS.map((c) => {
          const on = prefs.categories?.includes(c.id);
          return <button key={c.id} onClick={() => toggleCat(c.id)} className={`rounded-full px-4 py-2 text-sm font-semibold ${on ? "bg-foreground text-background" : "bg-card"}`}>{c.icon} {c.label}</button>;
        })}
      </div>

      <h2 className="mt-7 mb-2 font-bold">Your identity</h2>
      <Verified p={p} />
      {giving && <GiveSheet bill={giving} payerId={p.id} onClose={() => setGiving(null)} onDone={() => setGiving(null)} />}
    </Shell>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="rounded-2xl bg-card p-4 shadow-card"><div className="text-xs text-muted-foreground">{k}</div><div className="font-mono text-2xl font-semibold">{v}</div></div>;
}
