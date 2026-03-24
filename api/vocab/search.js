import { searchVocabulary } from "../../server/content-engine.js";

export default function handler(req, res) {
  res.status(200).json({ results: searchVocabulary(req.query?.q || "") });
}
