import { pickFocusEntry } from "../../server/content-engine.js";
import { generateTopicImage } from "../../server/openai-service.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const entry = pickFocusEntry(req.body || {});
    const image = await generateTopicImage(entry);
    res.status(200).json(image);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate image",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
