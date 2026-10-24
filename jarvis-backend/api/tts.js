const CANDIDATES = [
  process.env.ELEVENLABS_VOICE_ID,
  "pNInz6obpgDQGcFmaJgB", // Adam
  "JBFqnCBsd6RMkjVDRZzb", // George
  "nPczCjzI2devNBz1zQrb", // Brian
  "onwK4e9ZLuTAKqWW03F9", // Daniel
  "TxGEqnHWrfWFTfGW9XjX", // Josh
].filter(Boolean);

const MODEL_ID = process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";

let workingVoice = null;

async function speakWith(voiceId, text) {
  return fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text: text.slice(0, 500), model_id: MODEL_ID }),
    }
  );
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Use POST" });

  const { text } = req.body || {};
  if (!text || typeof text !== "string")
    return res.status(400).json({ error: "text required" });

  if (!process.env.ELEVENLABS_API_KEY)
    return res.status(500).json({ error: "ELEVENLABS_API_KEY missing in Vercel" });

  const order = workingVoice
    ? [workingVoice, ...CANDIDATES.filter((v) => v !== workingVoice)]
    : CANDIDATES;

  let lastError = "ElevenLabs error";

  try {
    for (const voiceId of order) {
      const r = await speakWith(voiceId, text);

      if (r.ok) {
        workingVoice = voiceId;
        const audio = Buffer.from(await r.arrayBuffer());
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).send(audio);
      }

      const body = await r.text();
      lastError = "HTTP " + r.status + ": " + body.slice(0, 160);

      // Key problem or quota problem: other voices will not help
      if (r.status === 401 || r.status === 429) break;
    }
    return res.status(502).json({ error: lastError });
  } catch (e) {
    return res.status(500).json({ error: "Server error: " + e.message });
  }
}
