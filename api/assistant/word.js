import { generateWordMaterials } from "../../server/openai-service.js";
import { readJsonBody, sendMethodNotAllowed } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    const body = await readJsonBody(req);
    const result = await generateWordMaterials({
      word: body?.word || "",
      level: body?.level || "",
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate word materials",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
