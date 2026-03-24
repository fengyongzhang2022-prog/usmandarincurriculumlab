import { generateCanDoMaterials } from "../../server/openai-service.js";
import { readJsonBody, sendMethodNotAllowed } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    const body = await readJsonBody(req);
    const result = await generateCanDoMaterials({
      canDo: body?.canDo || "",
      level: body?.level || "",
      mode: body?.mode || "",
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate can-do materials",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
