import { getDataset } from "../server/content-engine.js";
import { getProviderSummary, isOpenAIConfigured } from "../server/openai-service.js";

export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    openaiConfigured: isOpenAIConfigured(),
    provider: getProviderSummary(),
    summary: getDataset().summary,
  });
}
