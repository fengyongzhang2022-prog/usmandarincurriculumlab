import { pickFocusEntry } from "../../server/content-engine.js";
import { generateTopicImage } from "../../server/openai-service.js";
import { readJsonBody, sendMethodNotAllowed } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    const body = await readJsonBody(req);
    const entry = pickFocusEntry(body || {});
    const image = await generateTopicImage(entry);
    res.status(200).json(image);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate image",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
