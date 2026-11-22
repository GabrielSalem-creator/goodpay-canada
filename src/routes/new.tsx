import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "@/components/t4g/shell";
import { PhotoButton } from "@/components/t4g/photo";
import { Input } from "@/components/ui/input";
import { scanBill } from "@/lib/ai.functions";
import { ESSENTIALS, isEssential, PAYMENT_METHODS } from "@/lib/rules";
import { useProfile } from "@/lib/session";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "Post a bill — Transact4Good" },
      { name: "description", content: "Snap your essential bill. AI fills in the rest." },
      { property: "og:title", content: "Post a bill — Transact4Good" },
      { property: "og:description", content: "Snap your essential bill. AI fills in the rest." },
    ],
  }),
  component: NewBill,
});

function NewBill() {
  const { profile, loading } = useProfile();
  const nav = useNavigate();
  const qc = useQueryClient();
  const scan = useServerFn(scanBill);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<Record<string, unknown>>({});
  const [f, setF] = useState({
    category: "electricity", provider: "", method: "bill_payment", account: "", institution: "",
    amount: "", chunk: "20", due: "", note: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => { if (!loading && profile?.role !== "recipient") nav({ to: profile ? "/feed" : "/" }); }, [loading, profile, nav]);
  if (!profile) return null;

  async function onPhoto(image: string) {
    setBusy(true);
    try {
      const r = await scan({ data: { image } });
      setAi(r);
      if (r["essential"] === false) toast.error("This doesn’t look like an essential bill");
      if (typeof r["category"] === "string" && isEssential(r["category"])) set("category", r["category"]);
      if (r["provider"]) { set("provider", String(r["provider"])); set("institution", `${String(r["provider"])} biller`); }
      if (r["account"]) set("account", String(r["account"]));
      if (typeof r["amount"] === "number") set("amount", String(r["amount"]));
      if (typeof r["due_date"] === "string") set("due", r["due_date"]);
      if (typeof r["due_date"] !== "string") toast.error("No due date found — retake the photo"); else toast.success("Bill read");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the bill");
    } finally { setBusy(false); }
  }

  const amount = Number(f.amount) || 0;
  const chunk = Number(f.chunk) || amount;
  const method = PAYMENT_METHODS.find((m) => m.id === f.method)!;
  const ok = f.provider && f.account && amount > 0 && isEssential(f.category) && !!f.due;

  async function submit() {
    const { error } = await supabase.from("bills").insert({
      recipient_id: profile!.id, category: f.category, provider: f.provider, payee_account: f.account,
      payee_institution: f.institution || f.provider, payment_method: f.method, amount, chunk_size: Math.min(chunk, amount),
      due_date: f.due, note: f.note.slice(0, 140), ai_check: ai as never,
    });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries();
    toast.success("Bill posted. Givers can see it now.");
    nav({ to: "/me" });
  }

  return (
    <Shell role="recipient" title="Post a bill">
      <PhotoButton label="Snap your bill" capture="environment" busy={busy} onPhoto={onPhoto} />
      <L>Type</L>
      <div className="flex flex-wrap gap-2">
        {ESSENTIALS.map((c) => (
          <button key={c.id} onClick={() => set("category", c.id)} className={`rounded-full px-4 py-2 text-sm font-semibold ${f.category === c.id ? "bg-foreground text-background" : "bg-card"}`}>{c.icon} {c.label}</button>
        ))}
      </div>
      <L>Paid by</L>
      <div className="grid grid-cols-2 gap-2">
        {PAYMENT_METHODS.map((m) => (
          <button key={m.id} onClick={() => set("method", m.id)} className={`rounded-xl px-3 py-3 text-left text-sm font-semibold ${f.method === m.id ? "bg-foreground text-background" : "bg-card"}`}>{m.label}</button>
        ))}
      </div>
      <L>To</L>
      <div className="space-y-2">
        <Input placeholder="Biller (e.g. Hydro-Québec)" value={f.provider} onChange={(e) => set("provider", e.target.value)} className="h-12 rounded-xl" />
        <Input placeholder={method.hint} value={f.account} onChange={(e) => set("account", e.target.value)} className="h-12 rounded-xl font-mono" />
        {f.method === "pad" && <Input placeholder="Transit-Institution (e.g. 00011-815)" value={f.institution} onChange={(e) => set("institution", e.target.value)} className="h-12 rounded-xl font-mono" />}
      </div>
      <L>Amount</L>
      <div className="grid grid-cols-2 gap-2">
        <Input inputMode="decimal" placeholder="Total $" value={f.amount} onChange={(e) => set("amount", e.target.value)} className="h-12 rounded-xl font-mono" />
        <div className={`flex h-12 items-center justify-center rounded-xl font-mono text-sm ${f.due ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>{f.due ? `Due ${f.due} ✓` : "Due: from photo"}</div>
      </div>
      <div className="mt-2 flex gap-2">
        {["10", "20", "50", String(amount || "")].filter(Boolean).map((c, i, arr) => (
          <button key={c + i} onClick={() => set("chunk", c)} className={`flex-1 rounded-xl py-3 font-mono text-sm font-semibold ${f.chunk === c ? "bg-foreground text-background" : "bg-card"}`}>
            {i === arr.length - 1 && amount ? "No split" : `$${c}`}
          </button>
        ))}
      </div>
      <button disabled={!ok} onClick={submit} className="mt-6 w-full rounded-2xl bg-primary py-5 text-lg font-bold text-primary-foreground disabled:opacity-40">{f.due ? "Post" : "Snap the bill first"}</button>
    </Shell>
  );
}
function L({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</div>;
}
