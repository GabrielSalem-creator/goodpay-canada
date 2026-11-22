import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo, Progress } from "@/components/t4g/shell";
import { PhotoButton } from "@/components/t4g/photo";
import { scanDocument } from "@/lib/ai.functions";
import { CITIES, ESSENTIALS, incomeCap, isEligible, isValidSin, luhn, money } from "@/lib/rules";
import { setProfileId } from "@/lib/session";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join Transact4Good" },
      { name: "description", content: "Get verified in minutes. One identity, one anonymous account." },
      { property: "og:title", content: "Join Transact4Good" },
      { property: "og:description", content: "Get verified in minutes. One identity, one anonymous account." },
    ],
  }),
  component: Join,
});

type Role = "payer" | "recipient";
const ANIMALS = ["Maple", "Loon", "Birch", "Cedar", "Otter", "Heron", "Aspen", "Spruce", "Beaver", "Moose", "Lynx", "Puffin"];
const alias = () => `${ANIMALS[Math.floor(Math.random() * ANIMALS.length)]} ${String(Math.floor(1000 + Math.random() * 9000))}`;

function Join() {
  const nav = useNavigate();
  const scan = useServerFn(scanDocument);
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role | null>(null);
  const [name] = useState(alias);
  const [city, setCity] = useState("Montréal");
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [income, setIncome] = useState("");
  const [household, setHousehold] = useState(1);
  const [sin, setSin] = useState("");
  const [card, setCard] = useState("");
  const [cats, setCats] = useState<string[]>(["electricity", "heating", "water"]);
  const [cities, setCities] = useState<string[]>(["Montréal"]);

  const steps = role === "recipient" ? ["Role", "City", "ID", "Selfie", "Income", "Done"] : ["Role", "City", "ID", "Selfie", "Giving", "Done"];
  const next = () => setStep((s) => s + 1);

  async function runScan(kind: "id" | "selfie" | "income", image: string) {
    setBusy(true);
    try {
      const r = await scan({ data: { image, kind } });
      if (r["ok"]) {
        const label = kind === "id" ? `${r["doc_type"] ?? "ID"}${r["province"] ? " · " + r["province"] : ""}` : kind === "selfie" ? "passed" : String(r["doc_type"] ?? "income proof");
        setChecks((c) => ({ ...c, [kind]: label }));
        if (kind === "income" && typeof r["monthly_income_cad"] === "number") setIncome(String(Math.round(r["monthly_income_cad"] as number)));
        toast.success("Verified by AI");
        next();
      } else {
        const issues = Array.isArray(r["issues"]) ? (r["issues"] as string[]).join(", ") : "Try a clearer photo";
        toast.error(issues || "Not accepted");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check failed");
    } finally {
      setBusy(false);
    }
  }
  const skip = (kind: string, label: string) => { setChecks((c) => ({ ...c, [kind]: `${label} (demo)` })); next(); };

  async function finish() {
    if (!role) return;
    const inc = Number(income) || 0;
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        role, alias: name, city, province: CITIES[city] ?? "QC", verified: true,
        verification: { ...checks, ...(role === "recipient" ? { sin: `•••• ••${sin.replace(/\D/g, "").slice(-3)}` } : {}), risk: "low" },
        monthly_income: inc, household_size: household,
        preferences: role === "payer" ? { categories: cats, cities } : {},
        card_last4: role === "payer" ? card.replace(/\D/g, "").slice(-4) : null,
      })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    setProfileId(data.id);
    nav({ to: role === "payer" ? "/feed" : "/me" });
  }

  const inc = Number(income) || 0;
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8">
      <div className="flex items-center justify-between"><Logo small /><span className="font-mono text-xs text-muted-foreground">{step + 1}/{steps.length}</span></div>
      <div className="mt-4"><Progress value={(step + 1) / steps.length} /></div>
      <div className="mt-8 flex-1 animate-pop" key={step}>
        {step === 0 && (
          <>
            <H t="Why are you here?" s="Pick one. An identity can only ever hold one account." />
            <div className="space-y-3">
              <Choice on={() => { setRole("payer"); next(); }} t="I want to pay bills" s="Swipe, give, climb the board." />
              <Choice on={() => { setRole("recipient"); next(); }} t="I need help with a bill" s="Post essential bills, get them covered." />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <H t={`You’re ${name}.`} s="That’s your public name. Nobody sees your real one. Where do you live?" />
            <div className="flex flex-wrap gap-2">
              {Object.keys(CITIES).map((c) => (
                <Chip key={c} on={city === c} onClick={() => setCity(c)}>{c}</Chip>
              ))}
            </div>
            <Button className="mt-8 h-14 w-full rounded-2xl text-base" onClick={next}>Continue</Button>
          </>
        )}
        {step === 2 && (
          <>
            <H t="Scan your ID" s="Driver’s licence, passport, PR or health card. A McGill / student ID works as a second document." />
            <PhotoButton label="Take a photo of your ID" capture="environment" busy={busy} onPhoto={(d) => runScan("id", d)} />
            <Skip onClick={() => skip("id", "Driver licence · QC")} />
          </>
        )}
        {step === 3 && (
          <>
            <H t="Quick selfie" s="Proves you’re a real person and not a second account. Look at the camera." />
            <PhotoButton label="Take a selfie" capture="user" busy={busy} onPhoto={(d) => runScan("selfie", d)} />
            <Skip onClick={() => skip("selfie", "passed")} />
          </>
        )}
        {step === 4 && role === "recipient" && (
          <>
            <H t="Your income" s={`Help goes to people who need it. Cap for a household of ${household}: ${money(incomeCap(household))}/month.`} />
            <div className="space-y-3">
              <PhotoButton label="Photo of pay stub, T4 or benefits letter" capture="environment" busy={busy} onPhoto={(d) => runScan("income", d)} />
              <Input inputMode="numeric" placeholder="Monthly income (CAD)" value={income} onChange={(e) => setIncome(e.target.value)} className="h-14 rounded-2xl text-lg" />
              <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
                <span className="font-semibold">People at home</span>
                <div className="flex items-center gap-4 font-mono text-lg">
                  <button onClick={() => setHousehold((h) => Math.max(1, h - 1))}>−</button>{household}<button onClick={() => setHousehold((h) => h + 1)}>+</button>
                </div>
              </div>
              <Input inputMode="numeric" placeholder="SIN (only last 3 digits are kept)" value={sin} onChange={(e) => setSin(e.target.value)} className="h-14 rounded-2xl font-mono text-lg" />
              {income && !isEligible(inc, household) && <p className="text-sm font-semibold text-primary">Above the income cap — you can’t post bills.</p>}
              <Button
                className="h-14 w-full rounded-2xl text-base"
                disabled={!income || !isEligible(inc, household) || !isValidSin(sin)}
                onClick={() => { setChecks((c) => ({ ...c, income: c["income"] ?? "self-declared" })); next(); }}
              >
                {sin && !isValidSin(sin) ? "SIN not valid" : "Continue"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Demo SIN: 130 692 544</p>
            </div>
          </>
        )}
        {step === 4 && role === "payer" && (
          <>
            <H t="Who do you want to help?" s="Your feed leans this way. Fairness still comes first." />
            <Label>Bills</Label>
            <div className="flex flex-wrap gap-2">
              {ESSENTIALS.map((c) => (
                <Chip key={c.id} on={cats.includes(c.id)} onClick={() => setCats((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))}>{c.icon} {c.label}</Chip>
              ))}
            </div>
            <Label>Cities</Label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(CITIES).slice(0, 12).map((c) => (
                <Chip key={c} on={cities.includes(c)} onClick={() => setCities((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}>{c}</Chip>
              ))}
            </div>
            <Label>Card</Label>
            <Input inputMode="numeric" placeholder="Card number" value={card} onChange={(e) => setCard(e.target.value)} className="h-14 rounded-2xl font-mono text-lg" />
            <p className="mt-2 text-xs text-muted-foreground">Demo card: 4242 4242 4242 4242. Only the last 4 digits are stored.</p>
            <Button className="mt-6 h-14 w-full rounded-2xl text-base" disabled={!luhn(card)} onClick={next}>Continue</Button>
          </>
        )}
        {step === 5 && (
          <>
            <H t="You’re verified." s={`${name} · ${city}`} />
            <div className="receipt space-y-2 p-5 pb-8 font-mono text-sm">
              {Object.entries(checks).map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="uppercase text-muted-foreground">{k}</span><span>{v} ✓</span></div>
              ))}
            </div>
            <Button className="mt-8 h-14 w-full rounded-2xl text-base" onClick={finish}>Enter Transact4Good</Button>
          </>
        )}
      </div>
    </div>
  );
}

function H({ t, s }: { t: string; s: string }) {
  return <div className="mb-6"><h1 className="text-3xl font-extrabold tracking-tight">{t}</h1><p className="mt-2 text-muted-foreground">{s}</p></div>;
}
function Choice({ t, s, on }: { t: string; s: string; on: () => void }) {
  return (
    <button onClick={on} className="w-full rounded-2xl bg-card p-5 text-left shadow-card active:scale-[.99]">
      <div className="text-lg font-bold">{t} →</div><div className="text-sm text-muted-foreground">{s}</div>
    </button>
  );
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${on ? "bg-foreground text-background" : "bg-card text-foreground"}`}>{children}</button>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</div>;
}
function Skip({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="mt-4 w-full text-center text-sm text-muted-foreground underline underline-offset-4">Skip for demo</button>;
}
