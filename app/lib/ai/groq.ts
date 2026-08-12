import "server-only";
import { authEnv } from "@/app/lib/auth/env";
import type { AnomalyAlert } from "@/app/lib/budget/dashboard";

/**
 * On-demand enrichment for a single alert card on /personnel/alerts — never a detection pass.
 * Alerts themselves keep coming from anomaly_alerts (app/lib/alerts/alerts.ts); this only asks
 * Groq to explain one already-flagged alert in plain language when a reviewer clicks for it.
 * Raw fetch, no SDK, matching the rest of this codebase's REST-only convention.
 */

// VERIFY before shipping: Groq's hosted model catalog changes faster than most providers'.
// llama-3.3-70b-versatile is Groq's general-purpose flagship as of this writing — if it 404s,
// check https://console.groq.com/docs/models and update this one constant.
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

type AlertContext = Pick<
  AnomalyAlert,
  "alertType" | "recordRef" | "department" | "description" | "confidence" | "severity" | "detectedAt"
>;

/** The obligation record_ref points to, when it resolves to one — see app/lib/alerts/alerts.ts's getObligationContext. */
interface ObligationContext {
  amount: number;
  payee: string | null;
}

export async function getAlertExplanation(
  alert: AlertContext,
  obligation?: ObligationContext
): Promise<{ explanation?: string; error?: string }> {
  const apiKey = authEnv.groqApiKey;
  if (!apiKey) {
    return { error: "AI explanations are not configured. Set GROQ_API_KEY to enable this feature." };
  }

  const prompt = [
    `Alert type: ${alert.alertType}`,
    `Affected record: ${alert.recordRef}`,
    `Department: ${alert.department ?? "Unknown"}`,
    `Severity: ${alert.severity}`,
    `AI confidence: ${alert.confidence}%`,
    `Detected: ${alert.detectedAt}`,
    `Description: ${alert.description}`,
    ...(obligation
      ? [
          `Transaction amount: ₱${obligation.amount.toLocaleString("en-PH")}`,
          `Supplier: ${obligation.payee ?? "Unknown"}`,
        ]
      : []),
  ].join("\n");

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "You are assisting a municipal budget officer reviewing an AI-flagged anomaly in a " +
              "government appropriations ledger. Explain in plain language, in 3-5 sentences, why " +
              "this pattern is suspicious and what the reviewer should check next. Do not invent " +
              "facts beyond what is given.",
          },
          { role: "user", content: prompt },
        ],
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { error: body?.error?.message ?? "Explanation unavailable (offline)." };
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const explanation = data.choices?.[0]?.message?.content?.trim();
    return explanation ? { explanation } : { error: "Explanation unavailable (offline)." };
  } catch {
    return { error: "Explanation unavailable (offline)." };
  }
}
