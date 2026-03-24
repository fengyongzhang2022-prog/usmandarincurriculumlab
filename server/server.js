import express from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  findEntries,
  getDataset,
  getEntryById,
  getLevelResources,
  getModes,
  getTopicComparison,
  analyzePassage,
  pickFocusEntry,
  searchVocabulary,
  getVocabIndexSummary,
  searchGrammar,
  getGrammarIndexSummary,
} from "./content-engine.js";
import {
  generateCanDoMaterials,
  generateLessonPack,
  generateSynonymMaterials,
  generateTopicImage,
  generateWordMaterials,
  getProviderSummary,
  isOpenAIConfigured,
} from "./openai-service.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SITE_DIR = path.join(ROOT, "site");
const MESSAGE_DIR = path.join(ROOT, "data");
const MESSAGE_LOG = path.join(MESSAGE_DIR, "messages.jsonl");

app.use(express.json({ limit: "4mb" }));

app.use((req, res, next) => {
  const password = process.env.SITE_PASSWORD || "";
  const passwordHash = (process.env.SITE_PASSWORD_HASH || "").trim().toLowerCase();
  if (!password && !passwordHash) {
    next();
    return;
  }

  const username = process.env.SITE_USERNAME || "teacher";
  const authHeader = req.headers.authorization || "";
  const credentials = parseBasicHeader(authHeader);
  if (
    credentials &&
    credentials.username === username &&
    matchesPassword(credentials.password, password, passwordHash)
  ) {
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
    modes: getModes(),
    vocab: getVocabIndexSummary(),
    grammar: getGrammarIndexSummary(),
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

app.get("/api/levels/:level/resources", (req, res) => {
  res.json({ resources: getLevelResources(req.params.level) });
});

app.get("/api/vocab/search", (req, res) => {
  res.json({ results: searchVocabulary(req.query.q || "") });
});

app.post("/api/vocab/analyze", (req, res) => {
  res.json(analyzePassage(req.body?.text || ""));
});

app.get("/api/grammar/search", (req, res) => {
  const results = searchGrammar({
    level: req.query.level || "",
    query: req.query.q || "",
  });
  res.json({ results, summary: getGrammarIndexSummary() });
});

app.post("/api/messages", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim();
  const message = String(req.body?.message || "").trim();

  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  fs.mkdirSync(MESSAGE_DIR, { recursive: true });
  fs.appendFileSync(
    MESSAGE_LOG,
    JSON.stringify({
      createdAt: new Date().toISOString(),
      name,
      email,
      message,
    }, null, 0) + "\n",
    "utf8"
  );

  res.json({ ok: true });
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

app.post("/api/assistant/word", async (req, res) => {
  try {
    const result = await generateWordMaterials({
      word: req.body?.word || "",
      level: req.body?.level || "",
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate word materials",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/assistant/synonyms", async (req, res) => {
  try {
    const result = await generateSynonymMaterials({
      terms: req.body?.terms || "",
      level: req.body?.level || "",
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate synonym materials",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/assistant/cando", async (req, res) => {
  try {
    const result = await generateCanDoMaterials({
      canDo: req.body?.canDo || "",
      level: req.body?.level || "",
      mode: req.body?.mode || "",
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate can-do materials",
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

function parseBasicHeader(header) {
  if (!header.startsWith("Basic ")) return null;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const pivot = decoded.indexOf(":");
  if (pivot < 0) return null;
  return {
    username: decoded.slice(0, pivot),
    password: decoded.slice(pivot + 1),
  };
}

function matchesPassword(password, plain, hash) {
  if (hash) {
    const digest = crypto.createHash("sha256").update(password).digest("hex");
    return digest === hash;
  }
  return password === plain;
}
