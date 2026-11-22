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
        <h1 className="text-6xl font-extrabold leading-[0.9] tracking-tight">Pay a bill.<br /><span className="text-primary">Stay anonymous.</span></h1>
      </div>
      <div className="space-y-3">
        <button onClick={() => go(DEMO_PAYER, "/feed")} className="w-full rounded-2xl bg-primary px-6 py-5 text-left text-primary-foreground active:scale-[.99]">
          <div className="text-lg font-bold">I give →</div>
        </button>
        <button onClick={() => go(DEMO_RECIPIENT, "/me")} className="w-full rounded-2xl bg-foreground px-6 py-5 text-left text-background active:scale-[.99]">
          <div className="text-lg font-bold">I need help →</div>
        </button>
        <div className="flex justify-between pt-2 text-sm font-semibold">
          <Link to="/join" className="text-foreground underline underline-offset-4">Sign up</Link>
          <Link to="/admin" className="text-muted-foreground">Admin</Link>
        </div>
      </div>
    </div>
  );
}
