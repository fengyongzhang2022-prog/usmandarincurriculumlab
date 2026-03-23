import { pickFocusEntry } from "../../server/content-engine.js";
import { generateLessonPack } from "../../server/openai-service.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const entry = pickFocusEntry(req.body || {});
    const pack = await generateLessonPack(entry);
    res.status(200).json(pack);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate lesson pack",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
