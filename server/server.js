import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findEntries,
  getDataset,
  getEntryById,
  getTopicComparison,
  pickFocusEntry,
} from "./content-engine.js";
import { generateLessonPack, generateTopicImage, getProviderSummary, isOpenAIConfigured } from "./openai-service.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SITE_DIR = path.join(ROOT, "site");

app.use(express.json({ limit: "4mb" }));

app.use((req, res, next) => {
  const password = process.env.SITE_PASSWORD || "";
  if (!password) {
    next();
    return;
  }

  const username = process.env.SITE_USERNAME || "teacher";
  const authHeader = req.headers.authorization || "";
  const expected = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

  if (authHeader === expected) {
    next();
    return;
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="ACTFL Teacher Dashboard"');
  res.status(401).send("Authentication required");
});

app.use("/assets", express.static(SITE_DIR));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    openaiConfigured: isOpenAIConfigured(),
    provider: getProviderSummary(),
    summary: getDataset().summary,
  });
});

app.get("/api/entries", (req, res) => {
  const entries = findEntries(req.query);
  res.json({ entries });
});

app.get("/api/entries/:id", (req, res) => {
  const entry = getEntryById(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }
  res.json({ entry });
});

app.get("/api/topics/:topicCode/comparison", (req, res) => {
  res.json({ entries: getTopicComparison(req.params.topicCode) });
});

app.post("/api/generate/lesson-pack", async (req, res) => {
  try {
    const entry = pickFocusEntry(req.body || {});
    const pack = await generateLessonPack(entry);
    res.json(pack);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate lesson pack",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/generate/image", async (req, res) => {
  try {
    const entry = pickFocusEntry(req.body || {});
    const image = await generateTopicImage(entry);
    res.json(image);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate image",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(SITE_DIR, "index.html"));
});

app.use(express.static(SITE_DIR));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`ACTFL teacher dashboard running at http://localhost:${port}`);
});
