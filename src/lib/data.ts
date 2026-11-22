import { supabase } from "@/integrations/supabase/client";

export async function loadBillsWithPeople() {
  const [{ data: bills, error }, { data: pays }] = await Promise.all([
    supabase.from("bills").select("*, recipient:profiles!bills_recipient_id_fkey(alias, city, province, monthly_income, household_size)").order("created_at"),
    supabase.from("payments").select("bill_id, status").neq("status", "rejected"),
  ]);
  if (error) throw error;
  const recipientOf = new Map((bills ?? []).map((b) => [b.id, b.recipient_id]));
  const helped = new Map<string, number>();
  for (const p of pays ?? []) {
    const r = recipientOf.get(p.bill_id);
    if (r) helped.set(r, (helped.get(r) ?? 0) + 1);
  }
  return (bills ?? []).map((b) => ({
    ...b,
    amount: Number(b.amount),
    funded: Number(b.funded),
    chunk_size: Number(b.chunk_size),
    alias: b.recipient?.alias ?? "",
    city: b.recipient?.city ?? "",
    province: b.recipient?.province ?? "",
    monthly_income: Number(b.recipient?.monthly_income ?? 0),
    household_size: b.recipient?.household_size ?? 1,
    times_helped: helped.get(b.recipient_id) ?? 0,
  }));
}
export type LoadedBill = Awaited<ReturnType<typeof loadBillsWithPeople>>[number];
