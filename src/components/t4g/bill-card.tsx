import { categoryMeta, money } from "@/lib/rules";
import { Progress } from "./shell";

export type BillView = {
  id: string; category: string; provider: string; amount: number; funded: number;
  due_date: string; note: string; payment_method: string; chunk_size: number;
  alias?: string; city?: string; province?: string; times_helped?: number; household_size?: number; why?: string;
};

export function BillCard({ b }: { b: BillView }) {
  const meta = categoryMeta(b.category);
  const days = Math.ceil((Date.parse(b.due_date) - Date.now()) / 86_400_000);
  return (
    <div className="receipt select-none p-6 pb-9">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-4xl">{meta.icon}</div>
          <div className="mt-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">{meta.label}</div>
          <div className="text-xl font-bold">{b.provider}</div>
        </div>
        {b.why && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{b.why}</span>}
      </div>
      <div className="dotted-rule my-5" />
      <div className="font-mono text-5xl font-semibold tracking-tight">{money(b.amount - b.funded)}</div>
      <div className="mt-1 text-sm text-muted-foreground">left of {money(b.amount)}</div>
      <div className="mt-4"><Progress value={b.funded / b.amount} /></div>
      <div className="mt-5 grid grid-cols-3 gap-2 font-mono text-xs">
        <Cell k="Due" v={days <= 0 ? "today" : `${days}d`} />
        <Cell k="Where" v={b.city ?? "—"} />
        <Cell k="Helped" v={`${b.times_helped ?? 0}×`} />
      </div>
      {b.note && <p className="mt-5 text-[15px] leading-snug">“{b.note}”</p>}
      <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
        <span>{b.alias} · verified ✓</span>
        <span>min {money(Math.min(b.chunk_size, b.amount - b.funded))}</span>
      </div>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <div className="text-muted-foreground">{k}</div>
      <div className="truncate font-semibold text-foreground">{v}</div>
    </div>
  );
}
