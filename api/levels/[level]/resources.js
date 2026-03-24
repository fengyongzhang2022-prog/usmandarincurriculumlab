import { getLevelResources } from "../../../server/content-engine.js";

export default function handler(req, res) {
  const level = Array.isArray(req.query?.level) ? req.query.level[0] : req.query?.level;
  res.status(200).json({ resources: getLevelResources(level || "") });
}
