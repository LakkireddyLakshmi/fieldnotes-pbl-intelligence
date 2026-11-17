import type { GrantReport } from "./contracts.js";
import { HttpError } from "./errors.js";

const endpoint = "https://openrouter.ai/api/v1/chat/completions";

export async function generateGrantNarrative(report: GrantReport): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new HttpError(503, "OpenRouter is not configured. Set OPENROUTER_API_KEY in the server environment.");

  const model = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-5.2";
  const sourceFacts = {
    grant: report.grant,
    month: report.month,
    performance: report.performance,
    finance: report.finance,
    facts: report.facts,
    linkedEvidence: report.evidence.map(({ id, type, district, title, caption, usage }) => ({ id, type, district, title, caption, usage })),
  };
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(45_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "PBL Review Hub",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content: "Write a concise, professional monthly grant report narrative using only the supplied JSON facts. Never calculate, alter, or infer figures. Preserve all counts, percentages, dates, risk labels, status, and source-reported wording exactly. Explicitly distinguish source-reported attendance rate from attendance and enrollment counts; do not recompute it. State that linked media records are synthetic assessment-only items, not real field evidence. Do not claim causation or invent achievements, explanations, actions, owners, or due dates. If data is missing, say so. Use plain text with short paragraphs and a short review prompt.",
          },
          { role: "user", content: JSON.stringify(sourceFacts) },
        ],
      }),
    });
  } catch {
    throw new HttpError(502, "Could not reach OpenRouter. The source-based report is still available; please try again later.");
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(502, "OpenRouter rejected the server API key. Check OPENROUTER_API_KEY in the server environment.");
    }
    if (response.status === 429) throw new HttpError(503, "OpenRouter rate limit reached. Please try again later.");
    throw new HttpError(502, `OpenRouter could not generate this draft (HTTP ${response.status}). The source-based report is still available.`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  const narrative = typeof content === "string"
    ? content.trim()
    : Array.isArray(content) ? content.map((part) => part.text ?? "").join("").trim() : "";
  if (!narrative || narrative.length > 12_000) {
    throw new HttpError(502, "OpenRouter returned an empty or oversized draft. The source-based report is still available.");
  }
  return narrative;
}
