import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const VOCAB_XLSX_PATH = path.join(ROOT, "2026美国中文教学词汇与语法等级量表", "2026_ACTFL_Vocabulary_WithFilters.xlsx");
const GRAMMAR_XLSX_PATH = path.join(ROOT, "2026美国中文教学词汇与语法等级量表", "ACTFL语法量表总表.xlsx");
const VOCAB_JSON_PATH = path.join(DATA_DIR, "vocab-index.json");
const GRAMMAR_JSON_PATH = path.join(DATA_DIR, "grammar-index.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

if (fs.existsSync(VOCAB_XLSX_PATH)) {
  const workbook = XLSX.readFile(VOCAB_XLSX_PATH);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  const items = rows
    .map((row) => ({
      word: String(row["词语"] || "").trim(),
      pos: String(row["词性"] || "").trim(),
      actfl: String(row["ACTFL等级"] || "").trim(),
      hsk: String(row["HSK等级"] || "").trim(),
      pg: String(row["PG等级"] || "").trim(),
      basicEdu: String(row["义务教育等级"] || "").trim(),
    }))
    .filter((item) => item.word);

  fs.writeFileSync(VOCAB_JSON_PATH, JSON.stringify({ items }, null, 2), "utf-8");
  console.log(`Wrote vocab index to ${VOCAB_JSON_PATH}`);
}

if (fs.existsSync(GRAMMAR_XLSX_PATH)) {
  const workbook = XLSX.readFile(GRAMMAR_XLSX_PATH);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  const items = rows
    .map((row, index) => ({
      id: `grammar-${index + 1}`,
      level: normalizeSpaces(row["等级"]),
      category: normalizeSpaces(row["语法类"]),
      grammar: normalizeSpaces(row["语法项"]),
      example: String(row["例句"] || "").trim(),
    }))
    .filter((item) => item.level || item.category || item.grammar)
    .map((item) => ({
      ...item,
      searchKeys: buildGrammarSearchKeys(item),
    }));

  fs.writeFileSync(GRAMMAR_JSON_PATH, JSON.stringify({ items }, null, 2), "utf-8");
  console.log(`Wrote grammar index to ${GRAMMAR_JSON_PATH}`);
}

function normalizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeGrammarSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[“”"'‘’（）()［］\[\]\-—·、，,：:；;！？?!\s]/g, "")
    .replace(/的/g, "")
    .trim();
}

function buildGrammarSearchKeys(item) {
  const seeds = [item.grammar, item.category, `${item.category}${item.grammar}`].filter(Boolean);
  const variants = new Set();

  for (const seed of seeds) {
    const normalized = normalizeGrammarSearch(seed);
    if (!normalized) continue;
    variants.add(normalized);
    variants.add(normalized.replace(/字句/g, "句"));
    variants.add(normalized.replace(/句式/g, "句"));
    variants.add(normalized.replace(/结构/g, ""));
    variants.add(normalized.replace(/句/g, "字句"));
    variants.add(normalized.replace(/字/g, ""));
  }

  return [...variants].filter(Boolean);
}
