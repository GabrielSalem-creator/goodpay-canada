import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/t4g/shell";
import { DEMO_PAYER, DEMO_RECIPIENT, setProfileId } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Transact4Good — anonymous bill help in Canada" },
      { name: "description", content: "Verified Canadians post essential bills. Anonymous givers swipe to pay them." },
      { property: "og:title", content: "Transact4Good" },
      { property: "og:description", content: "Verified Canadians post essential bills. Anonymous givers swipe to pay them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const nav = useNavigate();
  const go = (id: string, to: "/feed" | "/me") => { setProfileId(id); nav({ to }); };
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8">
      <Logo />
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-5xl font-extrabold leading-[0.95] tracking-tight">
          Pay a stranger’s<br />hydro bill.<br /><span className="text-primary">Stay anonymous.</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Verified Canadians post essential bills. Givers swipe to cover them. Money waits in a vault until it’s checked.
        </p>
      </div>
      <div className="space-y-3">
        <button onClick={() => go(DEMO_PAYER, "/feed")} className="w-full rounded-2xl bg-primary px-6 py-5 text-left text-primary-foreground active:scale-[.99]">
          <div className="text-lg font-bold">Try as a giver →</div>
          <div className="text-sm opacity-80">Loon 0917 · Montréal · card on file</div>
        </button>
        <button onClick={() => go(DEMO_RECIPIENT, "/me")} className="w-full rounded-2xl bg-foreground px-6 py-5 text-left text-background active:scale-[.99]">
          <div className="text-lg font-bold">Try as someone with a bill →</div>
          <div className="text-sm opacity-80">Maple 4821 · Montréal · verified</div>
        </button>
        <div className="flex justify-between pt-2 text-sm font-semibold">
          <Link to="/join" className="text-foreground underline underline-offset-4">Create an account</Link>
          <Link to="/admin" className="text-muted-foreground">Admin vault</Link>
        </div>
      </div>
    </div>
  );
}
