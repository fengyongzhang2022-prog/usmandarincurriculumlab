import { pickFocusEntry } from "../../server/content-engine.js";
import { generateLessonPack } from "../../server/openai-service.js";
import { readJsonBody, sendMethodNotAllowed } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    const body = await readJsonBody(req);
    const entry = pickFocusEntry(body || {});
    const pack = await generateLessonPack(entry);
    res.status(200).json(pack);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate lesson pack",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
