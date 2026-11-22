import { describe, expect, it } from "vitest";
import { giftOptions, incomeCap, isEligible, isEssential, isValidSin } from "./rules";
import { rankBills, type FeedInput } from "./feed";

describe("eligibility", () => {
  it("caps monthly income by household size", () => {
    expect(incomeCap(1)).toBe(2600);
    expect(incomeCap(3)).toBe(4200);
  });
  it("rejects people above the cap", () => {
    expect(isEligible(2600, 1)).toBe(true);
    expect(isEligible(2601, 1)).toBe(false);
  });
  it("only allows essential bills", () => {
    expect(isEssential("electricity")).toBe(true);
    expect(isEssential("vacation")).toBe(false);
  });
  it("validates SIN with Luhn", () => {
    expect(isValidSin("130 692 544")).toBe(true);
    expect(isValidSin("123 456 789")).toBe(false);
  });
});

describe("splitting", () => {
  it("offers chunk, double chunk, and the rest", () => {
    expect(giftOptions(1000, 0, 20)).toEqual([20, 40, 1000]);
    expect(giftOptions(100, 90, 20)).toEqual([10]);
  });
});

describe("feed fairness", () => {
  const now = Date.parse("2026-11-22T00:00:00Z");
  const base: FeedInput = {
    id: "a", category: "water", amount: 100, funded: 0, due_date: "2026-12-10",
    created_at: "2026-11-15T00:00:00Z", city: "Montréal", province: "QC",
    monthly_income: 1500, household_size: 1, times_helped: 0,
  };
  it("shows people helped less before people helped more", () => {
    const helped = { ...base, id: "helped", times_helped: 5 };
    const fresh = { ...base, id: "fresh", times_helped: 0 };
    expect(rankBills([helped, fresh], {}, now).map((b) => b.id)).toEqual(["fresh", "helped"]);
  });
  it("shows older bills first when everything else is equal", () => {
    const old = { ...base, id: "old", created_at: "2026-11-01T00:00:00Z" };
    expect(rankBills([base, old], {}, now)[0]?.id).toBe("old");
  });
  it("hides fully funded bills", () => {
    expect(rankBills([{ ...base, funded: 100 }], {}, now)).toEqual([]);
  });
});
