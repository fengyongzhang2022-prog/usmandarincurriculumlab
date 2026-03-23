import { findEntries } from "../server/content-engine.js";

export default function handler(req, res) {
  res.status(200).json({ entries: findEntries(req.query || {}) });
}
