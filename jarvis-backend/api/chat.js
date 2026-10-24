const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          generationConfig: {
            maxOutputTokens: 300,
            temperature: 0.7,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok)
      return res
        .status(502)
        .json({ error: data?.error?.message || "Gemini error" });

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("")
      .trim();

    return res.json({ reply: reply || "Sorry, koi jawab nahi mila." });
  } catch (e) {
    return res.status(500).json({ error: "Server error: " + e.message });
  }
}
