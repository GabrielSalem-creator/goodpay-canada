import { createServerFn } from "@tanstack/react-start";
import { generateChatCompletion } from "@lovable.dev/ai-gateway";

type Val = string | number | boolean | null | string[];
type Json = Record<string, Val>;

async function askJson(system: string, text: string, image?: string): Promise<Json> {
  const content = image
    ? [
        { type: "text" as const, text },
        { type: "image_url" as const, image_url: { url: image } },
      ]
    : text;
  const res = await generateChatCompletion({
    model: "openai/gpt-6.1-sol",
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content;
  try {
    return JSON.parse(typeof raw === "string" ? raw : "{}") as Json;
  } catch {
    return { ok: false, issues: ["Could not read the AI answer"] };
  }
}

const PRIVACY =
  "This is a Canadian anonymous giving platform. Never output a person's name, address, ID number or date of birth. Answer only in JSON.";

/** Reads an ID, selfie, or income proof and judges it. */
export const scanDocument = createServerFn({ method: "POST" })
  .inputValidator((d: { image: string; kind: "id" | "selfie" | "income" }) => {
    if (!d.image?.startsWith("data:image/")) throw new Error("Send a photo");
    if (d.image.length > 8_000_000) throw new Error("Photo too large");
    return d;
  })
  .handler(async ({ data }) => {
    const prompts = {
      id: `Check if this is a real Canadian government or institutional ID (driver's licence, passport, PR card, health card, provincial ID, or a university ID like McGill as secondary). Return {"ok":boolean,"doc_type":string,"issuer":string,"province":string (2-letter or ""),"expired":boolean,"confidence":0-1,"issues":string[]}. ok=false if it is not an ID, is a screen photo of a photo, looks edited, or is expired.`,
      selfie: `Liveness check. Return {"ok":boolean,"single_face":boolean,"looks_live":boolean,"confidence":0-1,"issues":string[]}. ok=true only if exactly one real human face is clearly visible and it does not look like a photo of a screen or a printed photo.`,
      income: `This should be proof of income (pay stub, T4, Notice of Assessment, benefits letter, bank statement). Return {"ok":boolean,"doc_type":string,"monthly_income_cad":number|null,"confidence":0-1,"issues":string[]}. Convert yearly/biweekly amounts to monthly gross.`,
    } as const;
    return askJson(PRIVACY, prompts[data.kind], data.image);
  });

/** Reads a utility bill photo and pre-fills the form. */
export const scanBill = createServerFn({ method: "POST" })
  .inputValidator((d: { image: string }) => {
    if (!d.image?.startsWith("data:image/")) throw new Error("Send a photo");
    return d;
  })
  .handler(async ({ data }) =>
    askJson(
      PRIVACY + " You may output the biller name and the customer account number because they are needed to route the payment.",
      `Read this Canadian bill. Return {"ok":boolean,"category":"electricity"|"heating"|"water"|"internet"|"phone"|"housing"|"groceries"|"other","provider":string,"account":string,"amount":number|null,"due_date":"YYYY-MM-DD"|null,"essential":boolean,"issues":string[]}. essential=false for luxury (streaming, gym, travel, car payments, credit cards).`,
      data.image,
    ),
  );

/** AI vault reviewer: approve or hold back a payment before it reaches the biller. */
export const reviewPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { context: Record<string, unknown> }) => d)
  .handler(async ({ data }) => {
    const out = await askJson(
      "You are the compliance reviewer for a Canadian bill-paying vault (FINTRAC-aware: watch for structuring, self-funding, mismatched billers, non-essential spending, unverified users). Answer only in JSON.",
      `Review this pending payment before funds are released to the biller. Return {"decision":"approve"|"reject","risk":"low"|"medium"|"high","reason":string (one short sentence)}.\n${JSON.stringify(data.context)}`,
    );
    return {
      decision: out["decision"] === "reject" ? "reject" : "approve",
      risk: String(out["risk"] ?? "low"),
      reason: String(out["reason"] ?? ""),
    } as const;
  });
