// Fastest model first. If it is busy, fall back to the next one.
const MODELS = [
  { name: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite", thinking: null },
  { name: "gemini-3.8-flash", thinking: { thinkingLevel: "low" } },
  { name: "gemini-3.6-flash", thinking: { thinkingLevel: "low" } },
];

const SYSTEM =
  "You are JARVIS, a smart personal assistant for Zabeer. " +
  "Reply in the same language the user writes (Hindi/Hinglish/English). " +
  "Keep answers short and clear, 2-4 sentences unless asked for detail. " +
  "No markdown symbols, because replies are read aloud.";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function callGemini(model, body) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
    }
  );
  const data = await r.json();
  return { ok: r.ok, status: r.status, data };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Use POST" });

  const { message, history = [] } = req.body || {};
  if (!message || typeof message !== "string")
    return res.status(400).json({ error: "message required" });

  const contents = history
    .slice(-6)
    .map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: String(h.content).slice(0, 800) }],
    }))
    .concat({ role: "user", parts: [{ text: message.slice(0, 2000) }] });

  let lastError = "Gemini error";

  try {
    for (const m of MODELS) {
      const generationConfig = { maxOutputTokens: 400 };
      if (m.thinking) generationConfig.thinkingConfig = m.thinking;

      const { ok, data } = await callGemini(m.name, {
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        generationConfig,
      });

      if (ok) {
        const reply = (data.candidates?.[0]?.content?.parts || [])
          .map((p) => p.text || "")
          .join("")
          .trim();
        return res.json({ reply: reply || "Sorry, koi jawab nahi mila." });
      }

      lastError = data?.error?.message || "Gemini error";
    }
    return res.status(502).json({ error: lastError });
  } catch (e) {
    return res.status(500).json({ error: "Server error: " + e.message });
  }
}
