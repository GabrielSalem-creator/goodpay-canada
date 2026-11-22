import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo, StatusPill } from "@/components/t4g/shell";
import { reviewPayment } from "@/lib/ai.functions";
import { categoryMeta, money } from "@/lib/rules";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Vault admin — Transact4Good" },
      { name: "description", content: "Review held payments before they reach billers." },
      { property: "og:title", content: "Vault admin — Transact4Good" },
      { property: "og:description", content: "Review held payments before they reach billers." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

async function loadVault() {
  const { data } = await supabase
    .from("payments")
    .select("*, bill:bills!payments_bill_id_fkey(*, recipient:profiles!bills_recipient_id_fkey(alias, city, province, verified, monthly_income, household_size)), payer:profiles!payments_payer_id_fkey(alias, verified, card_last4)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

function Admin() {
  const qc = useQueryClient();
  const review = useServerFn(reviewPayment);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"held" | "released" | "rejected">("held");
  const q = useQuery({ queryKey: ["vault"], queryFn: loadVault });
  const rows = q.data ?? [];
  const sum = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + Number(r.amount), 0);

  async function decide(id: string, approve: boolean, why?: object) {
    const { error } = await supabase.rpc("decide_payment", { _payment: id, _approve: approve, _review: (why ?? { decision: approve ? "approve" : "reject", reason: "Manual admin decision" }) as never });
    if (error) toast.error(error.message);
    qc.invalidateQueries();
  }
  async function aiReview(r: (typeof rows)[number]) {
    setBusy(r.id);
    try {
      const out = await review({
        data: {
          context: {
            amount: r.amount, bill: { category: r.bill?.category, provider: r.bill?.provider, method: r.bill?.payment_method, account: r.bill?.payee_account, total: r.bill?.amount, funded: r.bill?.funded, due: r.bill?.due_date },
            recipient: r.bill?.recipient, payer: { verified: r.payer?.verified, has_card: !!r.payer?.card_last4 }, same_person: r.payer_id === r.bill?.recipient_id,
          },
        },
      });
      await decide(r.id, out.decision === "approve", out);
      toast(out.decision === "approve" ? "AI approved → sent to biller" : "AI rejected → refunded", { description: out.reason });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI review failed");
    } finally { setBusy(null); }
  }
  async function reviewAll() {
    for (const r of rows.filter((x) => x.status === "held")) await aiReview(r);
  }

  return (
    <div className="mx-auto min-h-[100dvh] max-w-3xl px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-12">
      <div className="flex items-center justify-between"><Logo small /><Link to="/" className="text-sm text-muted-foreground">Exit</Link></div>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Vault</h1>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Box k="Held" v={money(sum("held"))} />
        <Box k="Sent to billers" v={money(sum("released"))} />
        <Box k="Refunded" v={money(sum("rejected"))} />
      </div>

      <ol className="mt-5 grid grid-cols-4 gap-1 text-center text-[11px] font-semibold">
        {["Giver’s card charged", "Held in vault", "AI + admin review", "Paid to biller"].map((s, i) => (
          <li key={s} className="rounded-xl bg-card px-2 py-3 shadow-card"><div className="font-mono text-primary">{i + 1}</div>{s}</li>
        ))}
      </ol>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-full bg-card p-1 shadow-card">
          {(["held", "released", "rejected"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-foreground text-background" : ""}`}>{t}</button>
          ))}
        </div>
        {tab === "held" && <button onClick={reviewAll} disabled={!!busy} className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">AI review all</button>}
      </div>

      <div className="mt-4 space-y-3">
        {rows.filter((r) => r.status === tab).map((r) => {
          const rev = (r.ai_review ?? {}) as { reason?: string; risk?: string };
          return (
            <div key={r.id} className="rounded-2xl bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold">{categoryMeta(r.bill?.category ?? "").icon} {r.bill?.provider}</div>
                  <div className="font-mono text-xs text-muted-foreground">→ {r.bill?.payee_institution} · {r.bill?.payee_account} · {r.bill?.payment_method}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{r.payer?.alias} → {r.bill?.recipient?.alias} ({r.bill?.recipient?.city}) · income {money(Number(r.bill?.recipient?.monthly_income ?? 0))}/mo</div>
                </div>
                <div className="text-right"><div className="font-mono text-lg font-semibold">{money(Number(r.amount))}</div><StatusPill status={r.status} /></div>
              </div>
              {rev.reason && <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-xs">AI{rev.risk ? ` · ${rev.risk} risk` : ""}: {rev.reason}</p>}
              {r.status === "held" && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm font-semibold">
                  <button disabled={busy === r.id} onClick={() => aiReview(r)} className="rounded-xl bg-foreground py-2.5 text-background disabled:opacity-50">{busy === r.id ? "Reviewing…" : "AI review"}</button>
                  <button onClick={() => decide(r.id, true)} className="rounded-xl bg-accent py-2.5 text-accent-foreground">Release</button>
                  <button onClick={() => decide(r.id, false)} className="rounded-xl bg-muted py-2.5">Refund</button>
                </div>
              )}
            </div>
          );
        })}
        {rows.filter((r) => r.status === tab).length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nothing here.</p>}
      </div>

      <details className="mt-10 rounded-2xl bg-card p-5 text-sm shadow-card">
        <summary className="cursor-pointer font-bold">How money moves in production (Canada)</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
          <li>Card / Apple Pay / Google Pay / Interac charged by a licensed processor into a trust account held for users (the vault).</li>
          <li>Platform registers with FINTRAC as a money services business; transactions over $10,000 and suspicious activity are reported; KYC on both sides.</li>
          <li>Payouts go only to billers: Payments Canada bill-payment (biller ID + account), pre-authorized debit (transit-institution-account), or Interac e-Transfer to a verified landlord.</li>
          <li>Gifts are personal gifts, not charitable donations, so no tax receipts; registering a charity later would allow CRA receipts.</li>
          <li>Funds held until a bill is reviewed; rejected funds are refunded to the giver’s card.</li>
        </ul>
      </details>
    </div>
  );
}
function Box({ k, v }: { k: string; v: string }) {
  return <div className="rounded-2xl bg-card p-4 shadow-card"><div className="text-xs text-muted-foreground">{k}</div><div className="font-mono text-lg font-semibold sm:text-2xl">{v}</div></div>;
}
