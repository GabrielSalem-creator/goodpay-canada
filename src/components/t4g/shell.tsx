import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { setProfileId } from "@/lib/session";

type Role = "payer" | "recipient";

export function Logo({ small }: { small?: boolean }) {
  return (
    <span className={`font-extrabold tracking-tight ${small ? "text-lg" : "text-2xl"}`}>
      Transact<span className="text-primary">4</span>Good
    </span>
  );
}

export function Shell({ role, title, children, action }: { role: Role; title?: string; children: ReactNode; action?: ReactNode }) {
  const nav = useNavigate();
  const tabs =
    role === "payer"
      ? [
          { to: "/feed", label: "Feed" },
          { to: "/board", label: "Board" },
          { to: "/me", label: "Me" },
        ]
      : [
          { to: "/me", label: "My bills" },
          { to: "/new", label: "+ New" },
          { to: "/board", label: "Board" },
        ];
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col">
      <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <Logo small />
        <div className="flex items-center gap-3">
          {action}
          <button
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => { setProfileId(null); nav({ to: "/" }); }}
          >
            Switch
          </button>
        </div>
      </header>
      {title && <h1 className="px-5 pt-2 pb-3 text-3xl font-extrabold tracking-tight">{title}</h1>}
      <main className="flex-1 px-5 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-md">
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="flex-1 py-4 text-center text-sm font-semibold text-muted-foreground"
              activeProps={{ className: "flex-1 py-4 text-center text-sm font-semibold text-primary" }}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    held: "bg-warning/25 text-foreground",
    released: "bg-accent/20 text-accent",
    rejected: "bg-primary/15 text-primary",
    open: "bg-muted text-muted-foreground",
    funded: "bg-warning/25 text-foreground",
    paid: "bg-accent/20 text-accent",
  };
  const label: Record<string, string> = {
    held: "In vault", released: "Sent to biller", rejected: "Refunded",
    open: "Open", funded: "Fully funded · in review", paid: "Paid ✓",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${map[status] ?? ""}`}>{label[status] ?? status}</span>;
}
