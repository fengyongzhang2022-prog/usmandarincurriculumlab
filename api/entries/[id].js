import { getEntryById } from "../../server/content-engine.js";

export default function handler(req, res) {
  const entry = getEntryById(req.query.id);
  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }
  res.status(200).json({ entry });
}
