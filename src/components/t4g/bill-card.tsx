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
  const urgent = days <= 5;
  return (
    <div className="receipt flex h-full select-none flex-col p-7 pb-10">
      <div className="flex items-center justify-between">
        <span className="text-5xl">{meta.icon}</span>
        <span className={`rounded-full px-3 py-1 font-mono text-sm font-semibold ${urgent ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          {days <= 0 ? "today" : `${days}d`}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <div className="font-mono text-6xl font-semibold tracking-tight">{money(b.amount - b.funded)}</div>
        <div className="mt-2 text-lg font-semibold">{b.provider}</div>
        <div className="mt-6"><Progress value={b.funded / b.amount} /></div>
      </div>
      <div className="text-sm text-muted-foreground">{b.city}{b.times_helped ? ` · helped ${b.times_helped}×` : ""}</div>
    </div>
  );
}
