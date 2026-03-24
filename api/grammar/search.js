import { getGrammarIndexSummary, searchGrammar } from "../../server/content-engine.js";

export default function handler(req, res) {
  const results = searchGrammar({
    level: req.query?.level || "",
    query: req.query?.q || "",
  });
  res.status(200).json({ results, summary: getGrammarIndexSummary() });
}
