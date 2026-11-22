import { incomeCap } from "./rules";

export type FeedInput = {
  id: string;
  category: string;
  amount: number;
  funded: number;
  due_date: string;
  created_at: string;
  city: string;
  province: string;
  monthly_income: number;
  household_size: number;
  times_helped: number;
};
export type Prefs = { cities?: string[]; categories?: string[] };

const DAY = 86_400_000;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/**
 * For You ranking. Fairness first: people helped the least and waiting the
 * longest rise to the top, then real need, due-date urgency and the giver's preferences.
 */
export function scoreBill(b: FeedInput, prefs: Prefs, now = Date.now()) {
  const fairness = 1 / (1 + b.times_helped);
  const waiting = clamp((now - Date.parse(b.created_at)) / (30 * DAY));
  const need = clamp(1 - b.monthly_income / incomeCap(b.household_size));
  const daysLeft = (Date.parse(b.due_date) - now) / DAY;
  const urgency = clamp(1 - daysLeft / 14);
  const cityHit = !prefs.cities?.length || prefs.cities.includes(b.city);
  const catHit = !prefs.categories?.length || prefs.categories.includes(b.category);
  const match = (cityHit ? 0.6 : 0) + (catHit ? 0.4 : 0);
  const score = 0.3 * urgency + 0.25 * fairness + 0.2 * waiting + 0.15 * need + 0.1 * match;
  return { score, fairness, waiting, need, urgency, match };
}

export function rankBills<T extends FeedInput>(bills: T[], prefs: Prefs, now = Date.now()): T[] {
  return bills
    .filter((b) => b.funded < b.amount)
    .map((b) => ({ b, s: scoreBill(b, prefs, now).score }))
    .sort((x, y) => y.s - x.s)
    .map((x) => x.b);
}

/** Simple label explaining why a bill is shown. */
export function whyShown(b: FeedInput, prefs: Prefs, now = Date.now()): string {
  const s = scoreBill(b, prefs, now);
  if (s.urgency > 0.6) return "Due soon";
  if (b.times_helped === 0) return "Never helped";
  if (s.waiting > 0.3) return "Waiting a while";
  if (s.need > 0.5) return "High need";
  return "Matches your picks";
}
