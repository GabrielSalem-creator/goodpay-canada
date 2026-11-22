import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { giftOptions, money } from "@/lib/rules";
import type { LoadedBill } from "@/lib/data";

export function GiveSheet({ bill, payerId, onClose, onDone }: { bill: LoadedBill; payerId: string; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const opts = giftOptions(bill.amount, bill.funded, bill.chunk_size);
  const [pick, setPick] = useState(opts[0] ?? 0);
  const [busy, setBusy] = useState(false);
  async function pay() {
    setBusy(true);
    const { error } = await supabase.rpc("contribute", { _bill: bill.id, _payer: payerId, _amount: pick });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${money(pick)} held in the vault`, { description: `+${Math.ceil(pick)} points · released after review` });
    qc.invalidateQueries();
    onDone();
  }
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-foreground/40" onClick={onClose}>
      <div className="mx-auto w-full max-w-md animate-pop rounded-t-3xl bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm text-muted-foreground">{bill.provider} · {bill.alias}</div>
        <div className="mt-1 text-2xl font-extrabold">How much?</div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {opts.map((o, i) => (
            <button key={o} onClick={() => setPick(o)} className={`rounded-2xl py-4 font-mono text-lg font-semibold ${pick === o ? "bg-foreground text-background" : "bg-muted"}`}>
              {money(o)}
              <div className="font-sans text-[11px] font-medium opacity-70">{i === opts.length - 1 ? "all of it" : `${i + 1} share`}</div>
            </button>
          ))}
        </div>
        <button disabled={busy || !pick} onClick={pay} className="mt-6 w-full rounded-2xl bg-primary py-5 text-lg font-bold text-primary-foreground active:scale-[.99] disabled:opacity-50">
          {busy ? "Paying…" : `Pay ${money(pick)}`}
        </button>
        <p className="mt-3 text-center text-xs text-muted-foreground">Charged to your card. Held in the Transact4Good vault, then sent straight to the biller — never to the person.</p>
      </div>
    </div>
  );
}
