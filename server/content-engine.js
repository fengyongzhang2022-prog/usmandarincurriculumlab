import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "site", "data.json");

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));

const levelPriorities = data.summary.levels;

export function getDataset() {
  return data;
}

export function findEntries(filters = {}) {
  return data.entries.filter((entry) => {
    if (filters.level && entry.level !== filters.level) return false;
    if (filters.themeCode && entry.themeCode !== filters.themeCode) return false;
    if (filters.subthemeCode && entry.subthemeCode !== filters.subthemeCode) return false;
    if (filters.topicCode && entry.topicCode !== filters.topicCode) return false;
    if (filters.id && entry.id !== filters.id) return false;
    if (filters.search) {
      const haystack = [
        entry.canDo,
        entry.mode,
        entry.topicName,
        entry.themeName,
        entry.subthemeName,
        entry.coreWords,
        entry.relatedWords,
        entry.sample,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(String(filters.search).toLowerCase())) return false;
    }
    return true;
  });
}

export function getEntryById(id) {
  return data.entries.find((entry) => entry.id === id) || null;
}

export function getTopicComparison(topicCode) {
  return data.entries
    .filter((entry) => entry.topicCode === topicCode)
    .sort((a, b) => levelPriorities.indexOf(a.level) - levelPriorities.indexOf(b.level));
}

export function pickFocusEntry({ id, topicCode, level }) {
  if (id) return getEntryById(id);
  const candidates = findEntries({ topicCode, level });
  if (candidates.length) return candidates[0];
  const broader = findEntries({ topicCode });
  return broader[0] || data.entries[0];
}

export function tokenizeWords(text, limit = 10) {
  return String(text || "")
    .split(/[，,、；;。\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function buildFallbackLessonPack(entry) {
  const vocab = tokenizeWords(entry.coreWords, 8);
  const support = tokenizeWords(entry.relatedWords, 4);
  const anchorWords = [...vocab.slice(0, 5), ...support.slice(0, 2)].filter(Boolean);

  const examples = [
    {
      title: "听力热身",
      skillFocus: "Interpretive",
      text: `听老师说：今天我们要聊“${entry.topicName || entry.subthemeName}”。请你听到 ${anchorWords.slice(0, 3).join("、")} 的时候举手，然后说出你听懂了什么。`,
    },
    {
      title: "人际互动",
      skillFocus: "Interpersonal",
      text: `A：你觉得 ${anchorWords[0] || "这个"} 怎么样？ B：我觉得很不错，因为跟 ${anchorWords[1] || "这个话题"} 很有关系。 A：那你平常会不会用到 ${anchorWords[2] || "这些词"}？`,
    },
    {
      title: "表达演示",
      skillFocus: "Presentational",
      text: `请用 ${anchorWords.slice(0, 4).join("、")} 至少四个词，说一说你在“${entry.topicName || "这个话题"}”里的经验、看法或选择。`,
    },
    {
      title: "教师脚本",
      skillFocus: "Teacher Script",
      text: `老师可以这样说：先听，不要马上写。听完以后，用一句话告诉同伴你听到了什么信息；然后再补充一个细节。最后，我们一起比较谁的信息更完整。`,
    },
  ];

  const activity = {
    title: `${entry.topicName || "课堂任务"}微型任务链`,
    task: `围绕“${entry.topicName || entry.subthemeName}”完成一个从理解到表达的课堂任务包，目标对齐：${entry.canDo}`,
    warmup: `用 ${anchorWords.slice(0, 4).join(" / ")} 做 3 分钟快问快答，激活已有词汇。`,
    input: `教师展示一张与“${entry.topicName || entry.subthemeName}”相关的图片，让学生圈出听到的关键词并判断信息重点。`,
    teacherScript: `教师先说：先听，不要急着写。听完以后告诉同伴你听到了什么，再补充一个细节。如果不确定，可以用“我觉得”“我听到”来试着表达。`,
    output: `学生完成一个 ${entry.mode || "综合"} 任务：先两人练习，再以 AP/IB/OPI 风格做 45-60 秒口头或书面产出。`,
    studentOutput: `学生至少使用 ${anchorWords.slice(0, 4).join("、")} 中的若干词，完成一句信息陈述和一句带细节的补充。`,
    extension: "可拓展为比较任务、角色扮演、图片描述、信息差活动或跨文化回应。",
    differentiation: "基础组先做关键词替换和句型支架；提升组加入原因、比较或跨文化延伸。",
    assessment: "教师可按是否完成任务、是否提供细节、是否能持续表达三项做快速观察记录。",
  };

  const expertDebate = [
    {
      expert: "AP/IB 课程设计师",
      concern: "如果词汇很多但产出任务太散，学生容易只会认词，不会真正完成交流任务。",
      recommendation: `先把 can-do 拆成一个可评分小任务，再围绕 ${anchorWords.slice(0, 3).join("、")} 这些词做支架。`,
      classroomMove: "先给句型框架，再让学生做 45 秒限时表达，最后补文化比较一句。",
    },
    {
      expert: "ACTFL/OPI 口语评估教练",
      concern: "学生常常能说词，但一被追问就停住，说明课堂活动缺少延展性追问。",
      recommendation: `围绕“${entry.canDo}”连续追问原因、细节和个人体验，让学生从列词走向说明。`,
      classroomMove: "设置 3 个固定追问：为什么、请举例、跟以前比有什么不一样。",
    },
    {
      expert: "大学中文项目主任",
      concern: "同一班里学生背景差异大，材料如果只有一个难度，课堂很难真正照顾到所有人。",
      recommendation: "把任务拆成基础版和拓展版，让基础学生先完成信息提取，高阶学生再补评价与比较。",
      classroomMove: "同题双轨：基础组做信息完成表，提升组做观点陈述或跨文化回应。",
    },
  ];

  const image = buildFallbackImage(entry);

  return {
    source: "fallback",
    focusEntry: entry,
    examples,
    activity,
    expertDebate,
    image,
  };
}

export function buildFallbackImage(entry) {
  const title = sanitizeSvgText(entry.topicName || entry.subthemeName || "ACTFL Chinese");
  const subtitle = sanitizeSvgText(entry.level);
  const chips = tokenizeWords(entry.coreWords, 4).map(sanitizeSvgText);
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">`,
    `<defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#f8e7c6"/><stop offset="100%" stop-color="#dcebe7"/></linearGradient></defs>`,
    `<rect width="1200" height="720" fill="url(#bg)" rx="40"/>`,
    `<circle cx="170" cy="150" r="90" fill="#d8894a" opacity="0.24"/>`,
    `<circle cx="1010" cy="560" r="120" fill="#2f7c79" opacity="0.16"/>`,
    `<text x="72" y="130" font-family="Noto Sans SC, Microsoft YaHei, sans-serif" font-size="30" fill="#9d512f">Teaching Visual</text>`,
    `<text x="72" y="230" font-family="Noto Serif SC, Microsoft YaHei, serif" font-size="62" font-weight="700" fill="#1f1a17">${title}</text>`,
    `<text x="72" y="288" font-family="Noto Sans SC, Microsoft YaHei, sans-serif" font-size="28" fill="#355f5a">${subtitle}</text>`,
  ];

  chips.forEach((chip, index) => {
    const x = 72 + (index % 2) * 260;
    const y = 390 + Math.floor(index / 2) * 90;
    lines.push(`<rect x="${x}" y="${y}" width="220" height="54" rx="27" fill="#fff8ef" stroke="#b5522d" stroke-opacity="0.2"/>`);
    lines.push(`<text x="${x + 26}" y="${y + 35}" font-family="Noto Sans SC, Microsoft YaHei, sans-serif" font-size="26" fill="#1f1a17">${chip}</text>`);
  });

  lines.push(`</svg>`);
  return {
    source: "fallback",
    mimeType: "image/svg+xml",
    dataUrl: `data:image/svg+xml;base64,${Buffer.from(lines.join("")).toString("base64")}`,
    alt: `${entry.topicName || entry.subthemeName} 教学配图`,
  };
}

function sanitizeSvgText(value) {
  return String(value).replace(/[<>&"]/g, "");
}
