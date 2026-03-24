import { analyzePassage } from "../../server/content-engine.js";
import { readJsonBody, sendMethodNotAllowed } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res, ["POST"]);
    return;
  }

  const body = await readJsonBody(req);
  res.status(200).json(analyzePassage(body?.text || ""));
}
