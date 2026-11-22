import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "@/components/t4g/shell";
import { BillCard } from "@/components/t4g/bill-card";
import { GiveSheet } from "@/components/t4g/give-sheet";
import { loadBillsWithPeople, type LoadedBill } from "@/lib/data";
import { rankBills, type Prefs } from "@/lib/feed";
import { useProfile } from "@/lib/session";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Feed — Transact4Good" },
      { name: "description", content: "Swipe through verified essential bills and cover one." },
      { property: "og:title", content: "Feed — Transact4Good" },
      { property: "og:description", content: "Swipe through verified essential bills and cover one." },
    ],
  }),
  component: Feed,
});

function Feed() {
  const { profile, loading } = useProfile();
  const nav = useNavigate();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [giving, setGiving] = useState<LoadedBill | null>(null);
  const q = useQuery({ queryKey: ["bills"], queryFn: loadBillsWithPeople });

  useEffect(() => { if (!loading && (!profile || profile.role !== "payer")) nav({ to: profile ? "/me" : "/" }); }, [loading, profile, nav]);

  const prefs = (profile?.preferences ?? {}) as Prefs;
  const ranked = useMemo(() => rankBills((q.data ?? []).filter((b) => b.status === "open"), prefs), [q.data, prefs]);
  const deck = ranked.filter((b) => !skipped.includes(b.id));
  const top = deck[0];

  if (!profile) return null;
  const skip = () => top && setSkipped((s) => [...s, top.id]);
  const save = async () => {
    if (!top) return;
    await supabase.from("saves").upsert({ payer_id: profile.id, bill_id: top.id });
    toast("Saved for later");
    skip();
  };
  const help = () => {
    if (!profile.card_last4) { toast.error("Add a card first"); nav({ to: "/me" }); return; }
    if (top) setGiving(top);
  };

  return (
    <Shell role="payer" action={<span className="font-mono text-xs font-semibold">{profile.points} pts</span>}>
      {q.isLoading ? (
        <div className="receipt h-96 animate-pulse" />
      ) : !top ? (
        <div className="py-24 text-center">
          <div className="text-5xl">🍁</div>
          <p className="mt-4 text-xl font-bold">You’ve seen every bill.</p>
          <button className="mt-4 text-sm underline" onClick={() => setSkipped([])}>Start over</button>
        </div>
      ) : (
        <>
          <div className="relative h-[calc(100dvh-230px)] min-h-[380px]">
            {deck[1] && <div className="receipt absolute inset-x-4 top-3 bottom-[-12px] opacity-50" />}
            <Swipe key={top.id} onLeft={skip} onRight={help} onUp={save}>
              <BillCard b={top} />
            </Swipe>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6">
            <Act onClick={skip} label="✕" />
            <Act onClick={save} label="★" small />
            <Act onClick={help} label="$" primary />
          </div>
        </>
      )}
      {giving && <GiveSheet bill={giving} payerId={profile.id} onClose={() => setGiving(null)} onDone={() => { setGiving(null); }} />}
    </Shell>
  );
}

function Act({ onClick, label, primary, small }: { onClick: () => void; label: string; primary?: boolean; small?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label === "$" ? "Pay" : label === "★" ? "Save" : "Pass"} className={`flex items-center justify-center rounded-full font-bold shadow-card active:scale-90 ${small ? "h-12 w-12 text-lg" : "h-16 w-16 text-2xl"} ${primary ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>
      {label}
    </button>
  );
}

function Swipe({ children, onLeft, onRight, onUp }: { children: React.ReactNode; onLeft: () => void; onRight: () => void; onUp: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [d, setD] = useState({ x: 0, y: 0 });
  const end = () => {
    if (d.x > 110) onRight();
    else if (d.x < -110) onLeft();
    else if (d.y < -120) onUp();
    start.current = null;
    setD({ x: 0, y: 0 });
  };
  const hint = d.x > 40 ? "PAY" : d.x < -40 ? "PASS" : d.y < -50 ? "LATER" : null;
  return (
    <div
      className="relative z-10 h-full touch-none animate-pop"
      style={{ transform: `translate(${d.x}px, ${Math.min(0, d.y)}px) rotate(${d.x / 18}deg)`, transition: start.current ? "none" : "transform .25s" }}
      onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => start.current && setD({ x: e.clientX - start.current.x, y: e.clientY - start.current.y })}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {children}
      {hint && (
        <div className={`absolute top-6 left-1/2 -translate-x-1/2 rounded-xl border-4 px-4 py-1 text-2xl font-extrabold ${hint === "PAY" ? "border-accent text-accent" : hint === "PASS" ? "border-primary text-primary" : "border-foreground text-foreground"}`}>
          {hint}
        </div>
      )}
    </div>
  );
}
