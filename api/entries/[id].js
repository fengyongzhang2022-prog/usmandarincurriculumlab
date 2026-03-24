import { getEntryById } from "../../server/content-engine.js";

export default function handler(req, res) {
  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  const entry = getEntryById(id || "");
  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }
  res.status(200).json({ entry });
}
