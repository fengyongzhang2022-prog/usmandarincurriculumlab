import { getTopicComparison } from "../../../server/content-engine.js";

export default function handler(req, res) {
  const topicCode = Array.isArray(req.query?.topicCode) ? req.query.topicCode[0] : req.query?.topicCode;
  res.status(200).json({ entries: getTopicComparison(topicCode || "") });
}
