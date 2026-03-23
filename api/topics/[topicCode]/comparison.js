import { getTopicComparison } from "../../../server/content-engine.js";

export default function handler(req, res) {
  res.status(200).json({ entries: getTopicComparison(req.query.topicCode) });
}
