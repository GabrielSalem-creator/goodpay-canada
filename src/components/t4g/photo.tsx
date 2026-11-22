import { useRef, useState } from "react";

/** Reads a photo, shrinks it to ~1280px JPEG data URL. */
export async function fileToDataUrl(file: File, max = 1280): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL("image/jpeg", 0.85);
}

export function PhotoButton({ label, capture, onPhoto, busy }: {
  label: string; capture?: "user" | "environment"; onPhoto: (dataUrl: string) => void; busy?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => ref.current?.click()}
      className="relative flex aspect-[4/3] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card text-muted-foreground transition active:scale-[.99]"
    >
      {preview ? (
        <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <span className="text-4xl">📷</span>
          <span className="mt-2 font-semibold">{label}</span>
        </>
      )}
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 font-semibold text-foreground">
          AI is checking…
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture={capture}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const d = await fileToDataUrl(f);
          setPreview(d);
          onPhoto(d);
          e.target.value = "";
        }}
      />
    </button>
  );
}
