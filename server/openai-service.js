import OpenAI from "openai";
import { buildFallbackImage, buildFallbackLessonPack, getDataset, getLevelResources, searchGrammar, searchVocabulary, tokenizeWords } from "./content-engine.js";

const providerConfig = resolveProviderConfig();
const client = providerConfig.apiKey
  ? new OpenAI({
      apiKey: providerConfig.apiKey,
      baseURL: providerConfig.baseURL,
    })
  : null;
const assistantCache = new Map();
const ASSISTANT_CACHE_LIMIT = 120;

export function isOpenAIConfigured() {
  return Boolean(client);
}

export function getProviderSummary() {
  return {
    configured: Boolean(client),
    provider: providerConfig.provider,
    baseURL: providerConfig.baseURL,
    model: providerConfig.model,
    imageEnabled: providerConfig.imageEnabled,
  };
}

export async function generateLessonPack(entry) {
  if (!client) {
    return buildFallbackLessonPack(entry);
  }

  const levelResources = getLevelResources(entry.level).slice(0, 4);
  const grammarHints = searchGrammar({ level: entry.level }).slice(0, 8);

  const prompt = [
    "You are an expert Chinese curriculum design assistant for U.S. K-16 teachers.",
    "Return strict JSON only.",
    "Create a teacher-ready mini lesson pack aligned to the provided ACTFL entry.",
    "Audience: AP Chinese, IB Chinese, ACTFL OPI prep, and university Chinese.",
    "Requirements:",
    "- Write all teacher-facing content in Simplified Chinese, but keep key assessment labels like AP, IB, OPI in English.",
    "- Respect the level and topic. Do not use vocabulary far beyond the target level unless marked as stretch support.",
    "- Treat the provided ACTFL entry as the hard anchor. Do not drift to unrelated themes.",
    "- Reuse the sample style and discourse type, but do not copy sentences from the source sample.",
    "- Keep wording classroom-ready and printable. Avoid vague theory, meta commentary, or platform jargon.",
    "- The output must feel like polished classroom material, similar to sample-based Chinese teaching packets, not just loose sentences.",
    "- Produce 4 fresh teaching-ready sample blocks in the style of the source sample, not copied from it.",
    "- At least one block must be a mini dialogue, one must be a teacher script, and one must be a short listening or output task.",
    "- Produce a short activity sequence with these fields: task, warmup, input, teacherScript, output, studentOutput, extension, differentiation, assessment.",
    "- Produce 2 compact classroom support notes with these fields: focus, guidance, classroomMove.",
    "- Only use output fields requested by the JSON schema. No markdown code fences.",
    `Entry JSON: ${JSON.stringify(entry)}`,
    `Level resource hints: ${JSON.stringify(levelResources)}`,
    `Grammar hints at this level: ${JSON.stringify(grammarHints)}`,
    "JSON schema:",
    "{\"examples\":[{\"title\":\"\",\"text\":\"\",\"skillFocus\":\"\"}],\"activity\":{\"title\":\"\",\"task\":\"\",\"warmup\":\"\",\"input\":\"\",\"teacherScript\":\"\",\"output\":\"\",\"studentOutput\":\"\",\"extension\":\"\",\"differentiation\":\"\",\"assessment\":\"\"},\"supportNotes\":[{\"focus\":\"\",\"guidance\":\"\",\"classroomMove\":\"\"}]}",
  ].join("\n");

  const parsed = await requestJson(prompt);
  if (!parsed) {
    return buildFallbackLessonPack(entry);
  }

  return {
    source: "openai",
    focusEntry: entry,
    examples: parsed.examples || [],
    activity: parsed.activity,
    expertDebate: (parsed.supportNotes || []).map((item) => ({
      expert: item.focus || "",
      concern: item.guidance || "",
      recommendation: item.guidance || "",
      classroomMove: item.classroomMove || "",
    })),
    image: await generateTopicImage(entry),
  };
}

export async function generateWordMaterials({ word, level = "" }) {
  const cacheKey = `word:${String(word || "").trim()}|${String(level || "").trim()}`;
  const cached = readAssistantCache(cacheKey);
  if (cached) return cached;
  const matches = searchVocabulary(word)[0]?.matches || [];
  const levelHints = level ? getLevelResources(level).slice(0, 3) : [];
  const grammarHints = searchGrammar({ level, query: word }).slice(0, 5);

  if (!client) {
    const fallback = buildFallbackWordMaterials({ word, level, matches, levelHints, grammarHints });
    writeAssistantCache(cacheKey, fallback);
    return fallback;
  }

  const prompt = [
    "你是应用语言学与国际中文教育专家，要为美国一线中文教师生成可直接使用的词汇讲义。",
    "只输出严格 JSON。",
    "不要写空泛原则，不要写“建议先”“可以考虑”“适合放在课堂中”等空话。",
    "讲义必须像教师能直接发学生、或稍作修改后直接上课的材料。",
    "如果 ACTFL 词表已收录该词，必须优先依据 ACTFL 匹配信息组织内容；不要随意改等级。",
    "如果 ACTFL 没有精确收录，可以做谨慎推测，但必须明确写“ACTFL 未精确收录”。",
    "解释词义时尽量用更低一级或同级的简单词语，不要用更难的抽象定义。",
    "例句必须自然、短、可上课；练习必须是真能发给学生做的题，不要写教学原则。",
    "必须按下面结构输出，标题固定，不要多加别的节。",
    `目标词：${word}`,
    `教师指定等级（可为空）：${level || "未指定"}`,
    `ACTFL 匹配结果：${JSON.stringify(matches)}`,
    `同等级功能词参考：${JSON.stringify(levelHints)}`,
    `相关语法参考：${JSON.stringify(grammarHints)}`,
    "输出要求：",
    "1. 《一、基础档案》只写词性、ACTFL等级、其他等级（如有）、一句使用场景。",
    "2. 《二、核心释义与词汇网络》必须包含：极简释义、近义词、反义词、相似词族。若没有可靠项，就明确写“暂无可靠……”。",
    "3. 《三、构词法剖析》必须分析这个词内部结构；如果是单纯词，也要说清楚“不可再拆出有教学价值的语素”。",
    "4. 《四、核心搭配与实用例句》必须给出 3 组常用搭配，每组 2 个例句。格式写完整，不要只列词。",
    "5. 《五、5级梯度操练》必须给 5 级练习：替换、选择、连词成句、情境完成、自由表达。每级至少 2 题，能直接发学生。",
    "6. 《六、课堂资产包》必须给板书要点、最小讲解脚本、课堂提醒。每项都要具体。",
    "7. 不要出现‘平台’‘模块’‘AI’‘任务链’等词。",
    'JSON schema: {"documentTitle":"","overview":"","sections":[{"title":"一、基础档案","items":["",""]},{"title":"二、核心释义与词汇网络","items":["",""]},{"title":"三、构词法剖析","items":[""]},{"title":"四、核心搭配与实用例句","items":["",""]},{"title":"五、5级梯度操练","items":["",""]},{"title":"六、课堂资产包","items":["",""]}]}',
  ].join("\n");

  const parsed = await requestJson(prompt);
  const result = parsed || buildFallbackWordMaterials({ word, level, matches, levelHints, grammarHints });
  writeAssistantCache(cacheKey, result);
  return result;
}

export async function generateSynonymMaterials({ terms, level = "" }) {
  const parsedTerms = String(terms || "")
    .split(/[\s,，、；;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
  const cacheKey = `synonyms:${parsedTerms.join("|")}|${String(level || "").trim()}`;
  const cached = readAssistantCache(cacheKey);
  if (cached) return cached;

  if (!client) {
    const fallback = buildFallbackSynonymMaterials({ terms: parsedTerms, level });
    writeAssistantCache(cacheKey, fallback);
    return fallback;
  }

  const vocabHints = parsedTerms.map((term) => ({
    term,
    matches: searchVocabulary(term)[0]?.matches?.slice(0, 4) || [],
  }));

  const prompt = [
    "你是国际中文教育中的词汇辨析专家，要生成一份老师可直接使用、学生也能看懂的近义词辨析讲义。",
    "只输出严格 JSON。",
    "不要写空泛原则，不要只说‘更书面’‘更口语’就结束；要给真正能上课的辨析内容。",
    "讲义必须让老师拿来就能讲，也能直接截取给学生做练习。",
    `目标词组：${JSON.stringify(parsedTerms)}`,
    `教师指定等级（可为空）：${level || "未指定"}`,
    `ACTFL 匹配结果：${JSON.stringify(vocabHints)}`,
    "输出要求：",
    "1. 先给一个对比总览表，列出：词语、ACTFL等级、核心意思、语体色彩、常见搭配、易混点。",
    "2. 《基础档案与极简释义》要分别解释每个词，解释尽量用简单中文。",
    "3. 《核心差异对比》必须真正说明：语义差别、语体差别、搭配差别、不能互换的场景。",
    "4. 《典型句子对比》必须给成对句子，让老师一眼能拿去讲。",
    "5. 《可直接发给学生的辨析练习》必须给真题，不要给原则。至少包括：选词填空、改错、情境判断、自造句。",
    "6. 《教学提醒》只保留最关键的 2 到 3 条，不要空泛。",
    "7. 内容要短而实，不要写成长篇教研报告。",
    'JSON schema: {"documentTitle":"","overview":"","matrix":{"headers":["词汇","ACTFL等级","核心意思","语体色彩","常见搭配","易混点"],"rows":[["","","","","",""]]},"sections":[{"title":"一、基础档案与极简释义","items":["",""]},{"title":"二、核心差异对比","items":["",""]},{"title":"三、典型句子对比","items":["",""]},{"title":"四、可直接发给学生的辨析练习","items":["",""]},{"title":"五、教学提醒","items":["",""]}]}',
  ].join("\n");

  const parsed = await requestJson(prompt);
  const result = parsed || buildFallbackSynonymMaterials({ terms: parsedTerms, level });
  writeAssistantCache(cacheKey, result);
  return result;
}

export async function generateCanDoMaterials({ canDo, level = "", mode = "" }) {
  const cacheKey = `cando:${String(canDo || "").trim()}|${String(level || "").trim()}|${String(mode || "").trim()}`;
  const cached = readAssistantCache(cacheKey);
  if (cached) return cached;
  const focusEntry = matchEntryFromCanDo(canDo, level, mode);
  const levelHints = getLevelResources(level || focusEntry?.level || "").slice(0, 4);
  const grammarHints = searchGrammar({ level: level || focusEntry?.level || "" }).slice(0, 6);

  if (!client) {
    const fallback = buildFallbackCanDoMaterials({ canDo, level, mode, focusEntry, levelHints, grammarHints });
    writeAssistantCache(cacheKey, fallback);
    return fallback;
  }

  const prompt = [
    "你是 ACTFL 中文教学设计专家，要把一条 can-do 转成老师真的能用的课堂讲义。",
    "只输出严格 JSON。",
    "不要解释理论，不要写泛泛的‘任务链’‘先输入后输出’之类空话。",
    "先分析这条 can-do 到底要求学生能听懂、读懂、说出、写出什么，再围绕这个能力点生成材料。",
    "如果是低级别 can-do，不要硬拔高到 AP/IB/OPI 大讨论；要保持真实、可落地。",
    "如果是中高级 can-do，可以增加讨论题、观点题、语料建议和评测题。",
    `Can-do 原文：${canDo}`,
    `目标等级：${level || "未指定"}`,
    `目标模态：${mode || "未指定"}`,
    `最接近的大纲条目：${JSON.stringify(focusEntry || {})}`,
    `本等级功能词参考：${JSON.stringify(levelHints)}`,
    `相关语法参考：${JSON.stringify(grammarHints)}`,
    "输出要求：",
    "1. 《一、能力拆解》必须明确：学生要识别什么信息、理解什么关系、完成什么输出。",
    "2. 《二、推荐语料与材料入口》必须给出 3 至 5 种真的适合这条 can-do 的语料类型或文本形式。",
    "3. 《三、可直接发给学生的课堂任务》必须给可以马上发下去做的任务，不是教学原则。",
    "4. 《四、讨论题 / 输出题》必须给真正能问学生的问题；如果是低级别，就给图卡、配对、指认、简单问答；如果是中高级，再给 AP/IB/OPI 风格问题。",
    "5. 《五、教师备课提醒》只保留最关键的 2 至 4 条，必须紧贴这条 can-do 本身，不要泛谈大主题。",
    "6. 全文要短、准、具体，不要写成长篇报告。",
    'JSON schema: {"documentTitle":"","overview":"","sections":[{"title":"一、能力拆解","items":["",""]},{"title":"二、推荐语料与材料入口","items":["",""]},{"title":"三、可直接发给学生的课堂任务","items":["",""]},{"title":"四、讨论题 / 输出题","items":["",""]},{"title":"五、教师备课提醒","items":["",""]}]}',
  ].join("\n");

  const parsed = await requestJson(prompt);
  const result = parsed || buildFallbackCanDoMaterials({ canDo, level, mode, focusEntry, levelHints, grammarHints });
  writeAssistantCache(cacheKey, result);
  return result;
}

export async function generateTopicImage(entry) {
  if (!client || !providerConfig.imageEnabled) {
    return buildFallbackImage(entry);
  }

  const vocab = tokenizeWords(entry.coreWords, 6).join("、");
  const prompt = [
    "Create a clean, warm editorial illustration for a professional Chinese-teaching dashboard.",
    "No embedded text.",
    "Show a classroom-ready visual scene tied to this topic:",
    `Topic: ${entry.topicName}`,
    `Subtheme: ${entry.subthemeName}`,
    `Level: ${entry.level}`,
    `Representative vocabulary: ${vocab}`,
    "Style: modern educational illustration, clear objects, inclusive, usable for U.S. Chinese teachers.",
  ].join("\n");

  try {
    const imageResult = await client.images.generate({
      model: providerConfig.imageModel,
      prompt,
      size: "1024x1024",
    });

    const item = imageResult.data?.[0];
    if (item?.b64_json) {
      return {
        source: "openai",
        mimeType: "image/png",
        dataUrl: `data:image/png;base64,${item.b64_json}`,
        alt: `${entry.topicName} 教学配图`,
      };
    }
  } catch {
    return buildFallbackImage(entry);
  }

  return buildFallbackImage(entry);
}

function safeJsonParse(text) {
  const normalized = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(normalized);
  } catch {
    const match = normalized.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function requestJson(prompt) {
  try {
    const text = await requestText(prompt);
    return safeJsonParse(text);
  } catch {
    return null;
  }
}

async function requestText(prompt) {
  const system = [
    "You are a Chinese teaching preparation assistant for U.S. K-16 teachers.",
    "Return JSON only when the user asks for JSON.",
  ].join(" ");

  if (providerConfig.provider === "openai") {
    try {
      const response = await client.responses.create({
        model: providerConfig.model,
        input: `${system}\n${prompt}`,
      });
      if (response.output_text) {
        return response.output_text;
      }
    } catch {
      // fall through to chat.completions compatibility path
    }
  }

  const chat = await client.chat.completions.create({
    model: providerConfig.model,
    temperature: 0.15,
    max_tokens: 2200,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });

  return chat.choices?.[0]?.message?.content || "";
}

function readAssistantCache(key) {
  if (!assistantCache.has(key)) return null;
  const value = assistantCache.get(key);
  assistantCache.delete(key);
  assistantCache.set(key, value);
  return value;
}

function writeAssistantCache(key, value) {
  assistantCache.set(key, value);
  while (assistantCache.size > ASSISTANT_CACHE_LIMIT) {
    const oldestKey = assistantCache.keys().next().value;
    if (!oldestKey) break;
    assistantCache.delete(oldestKey);
  }
}

function buildFallbackWordMaterials({ word, level, matches, levelHints, grammarHints }) {
  const best = matches[0] || {};
  const levels = [...new Set(matches.map((item) => item.actfl).filter(Boolean))];
  const profile = getWordTeachingProfile(word);
  const collocations = profile.collocations.length ? profile.collocations : buildWordCollocations(word);
  const examples = profile.examples.length ? profile.examples : buildWordExamples(word);
  const drills = profile.drills.length ? profile.drills : buildWordDrills(word);
  const synonyms = profile.synonyms.length ? profile.synonyms.join("、") : "暂无可靠近义词建议";
  const antonyms = profile.antonyms.length ? profile.antonyms.join("、") : "暂无固定反义词建议";
  const family = profile.family.length ? profile.family.join("、") : "暂无稳定词族补充";
  const morphology = profile.morphology || buildWordMorphology(word);
  return {
    source: "fallback",
    kind: "word",
    documentTitle: `${word} 教学讲解卡`,
    overview: levels.length
      ? `${word} 在 ACTFL 词表中的参考等级是 ${levels.join("、")}。当前为本地回退讲义，请接通模型后获取更完整版本。`
      : `${word} 目前未在 ACTFL 词表中精确收录。当前为本地回退讲义，请接通模型后获取更完整版本。`,
    sections: [
      {
        title: "一、基础档案",
        items: [
          `ACTFL：${levels.join("、") || "未收录"}${best.pos ? `；词性：${best.pos}` : ""}${best.hsk ? `；HSK：${best.hsk}` : ""}${best.pg ? `；PG：${best.pg}` : ""}`,
          levels.length ? `推荐放在 ${level || levels[0]} 层级的话题表达、阅读理解或讨论任务中。` : "若继续使用，建议作为补充词，不直接作为核心考查词。",
        ],
      },
      {
        title: "二、核心释义与词汇网络",
        items: [
          profile.simpleMeaning,
          `近义词：${synonyms}`,
          `反义词：${antonyms}`,
          `相关词族：${family}`,
          profile.usageScene,
        ],
      },
      {
        title: "三、构词法剖析",
        items: [
          morphology,
          profile.teacherMove,
        ],
      },
      {
        title: "四、常用搭配与示例句",
        items: [
          ...collocations.map((item) => `搭配：${item}`),
          ...examples.map((item) => `例句：${item}`),
        ],
      },
      {
        title: "五、5级梯度操练",
        items: [
          ...drills,
        ],
      },
      {
        title: "六、课堂资产包",
        items: [
          `板书要点：${word} / ${profile.simpleMeaning.replace(/^可以先解释成：/, "").replace(/。$/, "")}`,
          `教师先说的话：${profile.teacherMove.replace(/^老师可以先说：|'|然后引出“.+?”。$/g, "")}`,
          `提醒：${profile.warning}`,
        ],
      },
    ],
  };
}

function buildFallbackSynonymMaterials({ terms, level }) {
  const [first = "词语A", second = "词语B", ...rest] = terms;
  const tail = rest.length ? `，并和 ${rest.join("、")} 一起比较` : "";
  const profile = getSynonymComparisonProfile(terms);
  const annotated = terms.map((term) => {
    const matches = searchVocabulary(term)[0]?.matches || [];
    const levels = [...new Set(matches.map((item) => item.actfl).filter(Boolean))];
    return `${term}：${levels.join("、") || "未收录"}`;
  });
  return {
    source: "fallback",
    kind: "synonyms",
    documentTitle: `${terms.join(" / ")} 辨析讲义`,
    overview: `当前为本地回退辨析讲义。接通模型后会生成更完整的讲义式辨析内容。`,
    matrix: {
      headers: ["词语", "ACTFL等级", "核心意思", "语体/搭配提醒"],
      rows: terms.map((term) => {
        const matches = searchVocabulary(term)[0]?.matches || [];
        const levels = [...new Set(matches.map((item) => item.actfl).filter(Boolean))];
        return [
          term,
          levels.join("、") || "未收录",
          buildSynonymCoreMeaning(term, first, second, profile),
          buildSynonymRegisterHint(term, first, second, profile),
        ];
      }),
    },
    sections: [
      {
        title: "一、基础档案与极简释义",
        items: [
          ...annotated,
          ...(profile.definitions.length ? profile.definitions : [
            `${first} 和 ${second}${tail} 都能表达相近意思，但不能总是互换。`,
            `先让学生知道：不是“哪个对哪个错”，而是“哪个更自然、哪个更像这类语境”。`,
          ]),
        ],
      },
      {
        title: "二、核心差异对比",
        items: [
          ...(profile.differences.length ? profile.differences : [
            `${first} 更适合先讲具体、直接、日常的使用场景。`,
            `${second} 更适合放进总结、趋势、书面表达或较抽象内容里。`,
            `${buildSynonymMisuseHint(first, second)}`,
          ]),
        ],
      },
      {
        title: "三、典型句子对比",
        items: [
          ...(profile.examples.length ? profile.examples : [
            buildSynonymSentence(first, second, 1),
            buildSynonymSentence(first, second, 2),
            buildSynonymSentence(first, second, 3),
          ]),
        ],
      },
      {
        title: "四、可直接发给学生的辨析练习",
        items: [
          ...(profile.drills.length ? profile.drills : [
            `练习 1：请在 4 个句子里选择“${first}”或“${second}”，并写出理由。`,
            `练习 2：把一段口语表达改得更书面一些，判断哪里可以换成“${second}”。`,
            `练习 3：学生自己写两句，一句更适合用“${first}”，一句更适合用“${second}”。`,
            `练习 4：给一个错误例句，让学生判断为什么不能随便把“${first}”和“${second}”互换。`,
          ]),
        ],
      },
      {
        title: "五、教师讲解提醒",
        items: [
          ...(profile.tips.length ? profile.tips : [
            "如果学生总说“两个都可以”，就继续追问：哪个更像口语？哪个更像书面语？",
            "最好把辨析放进真实情境，而不是只背定义。",
            `结课时可以让学生用“${first} / ${second}”各说一句跟自己生活有关的话。`,
          ]),
        ],
      },
    ],
  };
}

function buildFallbackCanDoMaterials({ canDo, level, mode, focusEntry, levelHints, grammarHints }) {
  const targetLevel = level || focusEntry?.level || "当前";
  const targetMode = mode || focusEntry?.mode || "综合";
  const canDoZh = extractChineseCanDo(canDo);
  const anchor = focusEntry?.topicName || focusEntry?.subthemeName || canDoZh || "该话题";
  const coreWords = tokenizeWords(focusEntry?.coreWords || "", 10);
  const sampleTitle = extractSampleAnchor(focusEntry?.sample || "");
  const candoPlan = analyzeCanDo({ canDo: canDoZh, level: targetLevel, mode: targetMode, anchor, coreWords, sampleTitle });

  return {
    source: "fallback",
    kind: "cando",
    documentTitle: "Can-do 课堂生成单",
    overview: `当前为本地回退版本。接通模型后会生成更完整的课堂讨论题、语料建议和输出任务。`,
    sections: [
      {
        title: "一、能做拆解",
        items: candoPlan.analysis,
      },
      {
        title: "二、推荐语料与材料入口",
        items: candoPlan.materials,
      },
      {
        title: "三、可直接发给学生的课堂任务",
        items: candoPlan.studentTasks,
      },
      {
        title: "四、讨论题 / 输出题",
        items: candoPlan.outputs,
      },
      {
        title: "五、教师备课提醒",
        items: [
          ...candoPlan.teacherNotes,
        ],
      },
    ],
  };
}

function matchEntryFromCanDo(canDo, level = "", mode = "") {
  const dataset = getDataset().entries || [];
  const needle = String(canDo || "").trim();
  if (!needle) return null;

  const scoped = dataset.filter((entry) => (!level || entry.level === level) && (!mode || entry.mode === mode));
  const exact = scoped.find((entry) => entry.canDo === needle);
  if (exact) return exact;
  const similar = scoped.find((entry) => entry.canDo.includes(needle) || needle.includes(entry.canDo));
  if (similar) return similar;
  return dataset.find((entry) => entry.canDo.includes(needle) || needle.includes(entry.canDo)) || null;
}

function summarizeLevelHints(levelHints) {
  return (levelHints || []).slice(0, 2).map((item) => {
    const compact = String(item.content || "")
      .replace(/\s+/g, " ")
      .replace(/[:：]\s*/g, "：")
      .slice(0, 26);
    return `${item.title}：${compact}${compact.length >= 26 ? "…" : ""}`;
  });
}

function summarizeGrammarHints(grammarHints) {
  return (grammarHints || []).slice(0, 2).map((item) => {
    const example = String(item.example || "可作为句型支架")
      .replace(/\s+/g, " ")
      .slice(0, 28);
    return `${item.grammar}：${example}${example.length >= 28 ? "…" : ""}`;
  });
}

function buildWordCollocations(word) {
  const preset = {
    保护: ["保护环境", "保护动物", "保护自己", "保护文物"],
    经历: ["一段经历", "个人经历", "成长经历", "难忘的经历"],
    终于: ["终于到了", "终于完成", "终于明白", "终于有机会"],
    总算: ["总算做完了", "总算找到", "总算来了", "总算明白了"],
  };
  return preset[word] || [`围绕“${word}”说一件事`, `用“${word}”补充一个细节`, `判断“${word}”适不适合这个情境`];
}

function buildSimplifiedGloss(word) {
  const preset = {
    保护: "可以先解释成：不让它受伤，不让它坏，要好好照顾。",
    经历: "可以先解释成：你以前做过、看过、遇到过的事情。",
    终于: "可以先解释成：等了很久以后，最后真的发生了。",
  };
  return preset[word] || `可以先用简单的话解释“${word}”的基本意思，再让学生从情境里猜它怎么用。`;
}

function buildWordExamples(word) {
  const preset = {
    总算: [
      "忙了两个小时，我们总算把教室布置好了。",
      "等了很久，他总算回我的消息了。",
      "这道题我做了三次，总算做对了。",
    ],
    保护: [
      "我们应该保护学校里的树和花。",
      "出门骑车的时候，也要保护自己。",
      "如果大家都注意一点，就能更好地保护环境。",
    ],
    经历: [
      "这次旅行是一次难忘的经历。",
      "她跟我们分享了自己的留学经历。",
      "有了这次经历，他以后更有信心了。",
    ],
  };
  return preset[word] || [
    `请用“${word}”说一句和学校生活有关的话。`,
    `请用“${word}”说一句和家庭或朋友有关的话。`,
    `请用“${word}”说一句和社会话题有关的话。`,
  ];
}

function buildWordMorphology(word) {
  const preset = {
    火灾: "核心结构：偏正式。火（属性，说明原因）+ 灾（中心语，表示灾害），就是“由火引起的灾害”。",
    总算: "可以提醒学生注意，“总”带整体、全部的感觉，“算”有得到结果、算出结论的意味，所以“总算”常带“终于有结果了”的语气。",
    保护: "“保”有保持、保全的意思，“护”有护着、不让受伤的意思，所以“保护”常表示把对象安全地留住。"
  };
  return preset[word] || `可以提醒学生观察“${word}”内部的构词关系：先看哪个部分说明类别、哪个部分说明核心意思。`;
}

function buildWordDrills(word) {
  return [
    `练习 1：判断下面 4 个情境里，哪两个最适合用“${word}”。`,
    `练习 2：把“${word}”放进 3 个句框里，练习不同主语和对象。`,
    `练习 3：请你用“${word}”写一句自己的真实经历或真实看法。`,
    `练习 4：老师给一张图或一条新闻标题，请学生用“${word}”补一句评论。`,
    `练习 5：两人一组，围绕“${word}”做 30 秒微型表达，并互相追问一个细节。`,
  ];
}

function getWordTeachingProfile(word) {
  const preset = {
    火灾: {
      simpleMeaning: "极简释义：因失火而造成的严重灾害。",
      teacherMove: "老师可以先给学生看一张建筑物起火的图片，再问：这只是“火”吗，还是已经变成严重的灾害了？然后引出“火灾”。",
      usageScene: "这个词常放在新闻、消防安全、公共安全、社会事件等语境里。",
      synonyms: ["灾难", "灾害"],
      antonyms: ["安全", "平安"],
      family: ["灾害", "灾难", "火警", "消防"],
      morphology: "核心结构：偏正式。火（属性，说明原因）+ 灾（中心语，表示灾害），就是“由火引起的灾害”。",
      collocations: ["一场火灾", "预防火灾", "扑灭火灾", "严重的火灾"],
      examples: [
        "一场火灾使他失去了家。",
        "消防员很快就扑灭了这场火灾。",
        "我们要提高意识，预防火灾。",
      ],
      drills: [
        "第 1 级（替换练习）：把“事故 / 地震”替换成“火灾”，再读通句子。",
        "第 2 级（选词填空）：在“火灾 / 安全”中选择合适的词填空，并说明原因。",
        "第 3 级（连词成句）：用“火灾 / 一场 / 工厂 / 发生了 / 里”组织句子。",
        "第 4 级（情境完成）：看到大楼冒浓烟时，说“看起来那里发生了______”。",
        "第 5 级（自由表达）：说一说你的城市通常怎样预防家庭火灾。",
      ],
      warning: "“火灾”是比较正式、偏新闻和公共安全的话语，不是看到一点火就都用“火灾”。",
    },
    总算: {
      simpleMeaning: "可以先解释成：等了很久、做了很多以后，最后终于有了结果。",
      teacherMove: "老师可以先说：'你等了很久，最后成功了，这时候可以说什么？' 然后引出“总算”。",
      usageScene: "这个词常放在“过程有点长、心里有期待、最后结果终于出现”的情境里。",
      synonyms: ["终于", "好不容易"],
      antonyms: ["始终没有", "一直没"],
      family: ["总算是", "好不容易", "终于"],
      collocations: ["总算做完了", "总算来了", "总算找到办法", "总算放心了"],
      examples: [
        "下了两天雨，今天总算出太阳了。",
        "我改了三次作文，总算写好了。",
        "老师解释以后，我总算明白这个语法点了。",
      ],
      drills: [
        "练习 1：读 4 个情境，判断哪两个可以用“总算”。",
        "练习 2：把“总算”填进 3 个句子里，再说说为什么不是“马上”。",
        "练习 3：请写一句“先难后成”的经历，用“总算”收尾。",
        "练习 4：两人一组，一人说困难过程，一人用“总算”总结结果。",
      ],
      warning: "不要把“总算”讲成单纯的“最后”。它通常带一点松了一口气或终于成功的感觉。",
    },
    保护: {
      simpleMeaning: "可以先解释成：不让它受伤，不让它坏，要好好照顾。",
      teacherMove: "老师可以先问：'学校里有什么东西需要大家一起照顾？' 再把学生答案收进“保护”。",
      usageScene: "这个词常跟环境、动物、文物、个人安全、隐私等对象一起出现。",
      synonyms: ["爱护", "照顾"],
      antonyms: ["破坏", "伤害"],
      family: ["保护区", "保护者", "受保护", "自我保护"],
      collocations: ["保护环境", "保护动物", "保护自己", "保护文物"],
      examples: [
        "我们应该一起保护校园环境。",
        "骑车的时候，头盔可以保护自己。",
        "旅游的时候，也要注意保护文物。",
      ],
      drills: [
        "练习 1：看 4 张图片，选出最适合用“保护”的两张并说明理由。",
        "练习 2：把“爱护”“保护”分别放进句子里，比较哪一个更自然。",
        "练习 3：请学生写一句建议：我们应该怎么保护……？",
        "练习 4：两人一组，围绕“保护环境”做 30 秒说明并补一个具体做法。",
      ],
      warning: "“保护”一般比“爱护”更正式，也更强调防止伤害或损失。",
    },
    经历: {
      simpleMeaning: "可以先解释成：你以前做过、看过、遇到过的事情。",
      teacherMove: "老师可以先让学生讲一件真实发生过的事，再告诉他们这种“亲身经过的事”可以叫“经历”。",
      usageScene: "这个词常放在成长、旅行、工作、留学、比赛、困难等话题里。",
      synonyms: ["经验", "体验"],
      antonyms: ["没有经历过"],
      family: ["亲身经历", "成长经历", "经历过", "经历丰富"],
      collocations: ["一段经历", "个人经历", "成长经历", "难忘的经历"],
      examples: [
        "这次旅行是一次难忘的经历。",
        "她在面试时介绍了自己的实习经历。",
        "有了这次经历，我以后更有信心了。",
      ],
      drills: [
        "练习 1：请学生判断 4 个句子里哪两个更适合用“经历”，哪两个更适合用“经验”。",
        "练习 2：用“经历”完成句框：这次……是我第一次……的经历。",
        "练习 3：围绕一次难忘经历写 3 句话：什么时候、发生了什么、你学到了什么。",
      ],
      warning: "“经历”偏重“事情本身”，而“经验”更偏重“从事情里学到的东西”。",
    },
    终于: {
      simpleMeaning: "可以先解释成：等了很久以后，最后真的发生了。",
      teacherMove: "老师可以先说一个“等了很久”的故事，再让学生猜：最后成功的时候可以用哪个词。",
      usageScene: "常出现在等待、努力、寻找、完成、实现目标等语境里。",
      synonyms: ["总算", "最后"],
      antonyms: ["一直没", "始终没有"],
      family: ["终于还是", "终于可以", "终于明白"],
      collocations: ["终于到了", "终于完成", "终于看见", "终于有机会"],
      examples: [
        "考完试以后，我们终于可以休息了。",
        "她找了很久，终于找到那本书了。",
        "听完老师的解释，我终于明白了。",
      ],
      drills: [
        "练习 1：读 4 个情境，判断哪两个最适合用“终于”。",
        "练习 2：把“终于”和“马上”分别放进句子里，比较语义差别。",
        "练习 3：请学生写一句“等了很久以后”的真实经历。",
      ],
      warning: "“终于”可以只表示“最后实现了”，不一定像“总算”那样带强烈松一口气的感觉。",
    },
  };
  return preset[word] || {
    simpleMeaning: buildSimplifiedGloss(word),
    teacherMove: `老师可以先给一个最常见的情境，再追问学生：在这个情境里，“${word}”是什么意思？`,
    usageScene: `先告诉学生“${word}”通常放在哪些对象、行动或问题上，再进入例句。`,
    synonyms: [],
    antonyms: [],
    family: [],
    collocations: [],
    examples: [],
    drills: [],
    warning: "不要只给定义，最好先给情境，再让学生判断能不能用。",
  };
}

function buildSynonymCoreMeaning(term, first, second, profile = null) {
  const mapped = profile?.matrixMeanings?.[term];
  if (mapped) return mapped;
  const preset = {
    常常: "表示经常发生，多用于一般习惯或重复动作。",
    往往: "表示常有这种情况，常带总结或规律色彩。",
    因为: "直接说明原因，口语和书面语都常见。",
    由于: "更偏书面，常放在正式说明或分析里。",
  };
  if (preset[term]) return preset[term];
  if (term === first) return "更偏直接、具体的常用表达。";
  if (term === second) return "更偏书面、总结或抽象表达。";
  return "请结合具体语境判断它的核心意思。";
}

function buildSynonymRegisterHint(term, first, second, profile = null) {
  const mapped = profile?.matrixRegisters?.[term];
  if (mapped) return mapped;
  const preset = {
    常常: "更口语，常接具体动作或日常习惯。",
    往往: "更适合总结、趋势、规律、判断。",
    因为: "口语和书面都常见，位置更灵活。",
    由于: "更书面，常出现在正式说明前面。",
  };
  if (preset[term]) return preset[term];
  if (term === first) return "更适合先从具体使用场景讲起。";
  if (term === second) return "更适合放在书面语或总结性语境中比较。";
  return "要结合前后文看搭配是否自然。";
}

function buildSynonymMisuseHint(first, second) {
  const preset = {
    "常常|往往": "“常常”更像习惯动作；“往往”更像带总结意味的规律判断，不适合所有具体动作句。",
    "因为|由于": "“因为”口语、书面都常见；“由于”更书面，学生在口语里全都换成“由于”会显得不自然。",
    "总算|终于": "“总算”常带松一口气的感觉；“终于”更中性，不能完全互换。",
    "一直|总是": "“一直”更强调持续不变；“总是”更强调反复如此，带说话人的观察或评价。",
    "即使|就算": "“即使”更通用、更正式；“就算”更口语，也更常放在不太理想的假设里。",
  };
  return preset[`${first}|${second}`] || "课堂上不要只说“差不多”，要让学生判断哪个词跟哪个对象搭配更自然。";
}

function buildSynonymSentence(first, second, variant) {
  const presets = {
    "常常|往往": [
      "1. 他周末常常去图书馆看书，但考试前他往往会待得更久。",
      "2. 小孩子常常因为喜欢就马上去做；成年人往往会先想后果。",
      "3. 这类错误常常出现在初学阶段；一到正式写作里，问题往往更明显。",
    ],
    "因为|由于": [
      "1. 因为今天下雨，所以我们改成线上上课。",
      "2. 由于天气原因，活动时间需要调整。",
      "3. 学生会问为什么；老师可以顺便比较“因为”更口语，“由于”更书面。",
    ],
    "一直|总是": [
      "1. 他一直坐在教室里等老师来。 / 他总是坐在教室最后一排。 （“一直”说持续，“总是”说习惯）",
      "2. 这条路一直往前走就到了。 / 他上课总是先记笔记。 （前者不能换成“总是”）",
      "3. 妈妈一直很支持我。 / 妈妈总是提醒我要早点睡。 （一个偏状态持续，一个偏反复动作）",
    ],
    "即使|就算": [
      "1. 即使明天下雨，我们也要去公园。 （更正式、更通用）",
      "2. 就算你不喜欢，也请先尝一下。 （更口语，像日常说话）",
      "3. 即使工作很忙，他也每天给家人打电话；就算这次没考好，也不要放弃。 （假设色彩和语体不同）",
    ],
  };
  const key = `${first}|${second}`;
  if (presets[key]) return presets[key][variant - 1];
  return `${variant}. 请分别用“${first}”和“${second}”放进两个相近但不完全一样的情境里，再说明为什么不能互换。`;
}

function getSynonymComparisonProfile(terms) {
  const key = terms.join("|");
  const presets = {
    "即使|就算": {
      matrixMeanings: {
        即使: "假设一个情况，结果不变；更通用、更正式。",
        就算: "假设一个情况，结果不变；更口语，常带不太理想的假设。",
      },
      matrixRegisters: {
        即使: "书面语和口语都可；更正式。常见：即使……也……",
        就算: "更口语化，常见：就算……也……",
      },
      definitions: [
        "即使：意思是“如果（有）……也……”。它更基础、更通用，说话和写文章都可以用。",
        "就算：意思也接近“如果（有）……也……”，但更口语化，更像日常说话时的表达。",
      ],
      differences: [
        "【即使】更正式，也更稳，好的、坏的、极端的假设都能放进去。",
        "【就算】更像口语，常放在说话人觉得不太理想、但结果仍然不变的情况里。",
        "如果学生只记一个“even if”，先教“即使”；等学生稳定以后，再补“就算”的口语色彩。",
      ],
      examples: [
        "即使明天下雨，我们也要去公园。 （更正式、更通用）",
        "就算你不喜欢，也请尝一下。 （更口语，像说话安慰或劝说）",
        "即使工作很忙，他也每天给家人打电话；就算这次没考好，也别放弃。 （语体和情感色彩不同）",
      ],
      drills: [
        "练习 1：给 4 个“even if”句子，让学生判断更适合用“即使”还是“就算”。",
        "练习 2：把 2 个正式句子改成口语版，看看哪里可以换成“就算”。",
        "练习 3：学生自己各写一句：一句更像正式表达，一句更像安慰或劝说。",        
      ],
      tips: [
        "对初级学习者，先明确：大多数情况下“即使……也……”更安全。",
        "“就算”可以后教，重点让学生听出它更口语、更像真实对话。",
      ],
    },
    "总是|一直": {
      matrixMeanings: {
        一直: "表示持续不变，也可表示方向或时间上的连续。",
        总是: "表示反复如此，常带习惯或观察意味。",
      },
      matrixRegisters: {
        一直: "常跟持续状态、持续动作、方向搭配。",
        总是: "常跟习惯动作、反复发生的情况搭配。",
      },
      definitions: [
        "一直：常表示一个状态或动作持续不断，也可以表示方向或时间上的连续。",
        "总是：常表示某种情况反复出现，带“老是这样”的观察意味。",
      ],
      differences: [
        "【一直】重点是“从开始到现在，中间没断”或“沿着一个方向继续”。",
        "【总是】重点是“常常这样，反复这样”，更像习惯、规律或说话人的评价。",
        "如果句子说的是持续状态，用“一直”更自然；如果句子说的是反复发生，用“总是”更自然。",
      ],
      examples: [
        "他一直在图书馆学习到晚上十点。 （持续）",
        "他上课总是坐在最后一排。 （反复如此）",
        "这条路一直往前走就到了；他总是忘记带学生证。 （一个说方向，一个说习惯）",
      ],
      drills: [
        "练习 1：给 4 个句子，判断该填“一直”还是“总是”，并写出理由。",
        "练习 2：把“持续状态”和“反复习惯”各写 2 句，分别用“一直”和“总是”。",
        "练习 3：找出一个不能互换的句子，并说明为什么换了以后不自然。",
      ],
      tips: [
        "学生最容易把两个词都当“always”。教学时一定要把“持续”与“反复”分开。",
        "可以先让学生配动作线图：一条不断线表示“一直”，多个重复点表示“总是”。",
      ],
    },
  };
  return presets[key] || { definitions: [], differences: [], examples: [], drills: [], tips: [] };
}

function extractSampleAnchor(sample) {
  const line = String(sample || "")
    .split(/\n+/)
    .map((item) => item.trim())
    .find((item) => item && item !== "[图片]" && item.length > 5);
  return line
    ? line
        .replace(/\[图片\]/g, "")
        .replace(/^(理解|解读|导读|作品导读)[:：]\s*/g, "")
        .slice(0, 28)
    : "";
}

function extractChineseCanDo(canDo) {
  const text = String(canDo || "").trim();
  const chinese = text.match(/[\u4e00-\u9fff][\s\S]*$/);
  return chinese ? chinese[0].trim() : text;
}

function buildCorpusHints(anchor, mode, sampleTitle) {
  const shared = [
    `优先找与“${anchor}”有关的真实短视频、采访、海报、图文帖或论坛发言。`,
    "最好准备一长一短两份材料：一份帮助提取信息，一份帮助比较、回应或评价。",
  ];
  if (sampleTitle) {
    shared.unshift(`当前条目的原始示例“${sampleTitle}”可以先作为课堂热身，再外接同主题真实材料。`);
  }
  if (mode === "理解诠释") {
    shared.push("理解诠释课更适合：采访、说明文、图表解读、社交媒体帖子、宣传材料。");
  } else if (mode === "人际沟通") {
    shared.push("人际沟通课更适合：聊天记录、论坛回帖、口头访谈、任务卡、情境对话。");
  } else if (mode === "表达演示") {
    shared.push("表达演示课更适合：海报、口头展示提纲、评论短文、观点陈述、微演讲示例。");
  }
  return shared;
}

function buildDiscussionPrompts(anchor, mode, coreWords) {
  const keywordTail = coreWords.length ? `可以尽量带上这些词：${coreWords.slice(0, 5).join("、")}。` : "";
  return {
    discussion: [
      `讨论题 1：围绕“${anchor}”，你最想让学生表达“信息、经历、还是观点”？为什么？`,
      `讨论题 2：如果把“${anchor}”放到美国中文课堂里，学生最有可能有话可说的切入口是什么？`,
      `讨论题 3：这个话题在中国和美国可能有什么不同？请至少准备一个可以继续追问的角度。`,
      keywordTail || `讨论题 4：让学生先列 3 个关键词，再围绕“${anchor}”做小组讨论。`,
    ].filter(Boolean),
    output: [
      `口语题：请结合“${anchor}”讲一件你自己的经历、观察或选择，并说明原因。`,
      `比较题：如果把“${anchor}”放到中国和美国两个场景里，最明显的差别是什么？`,
      `写作题：请写一段 120-180 字的小短文，说明“${anchor}”为什么值得关注。`,
      `追问题：如果你是老师，你会继续问学生哪两个问题，才能把回答从“会说一点”推进到“说得更具体”？`,
    ],
  };
}

function analyzeCanDo({ canDo, level, mode, anchor, coreWords, sampleTitle }) {
  const isNovice = /^Novice/.test(level);
  const isMid = /^Intermediate (Low|Mid)/.test(level);
  const materials = [];
  const analysis = [];
  const studentTasks = [];
  const outputs = [];
  const teacherNotes = [];

  if (/辨认|识别|指出/.test(canDo) && /地点|商店|标识|货架通道/.test(canDo)) {
    analysis.push(
      `这条 can-do 的核心不是“谈${anchor}”，而是“看见标识以后，能不能马上认出它是什么地方”。`,
      "学生真正要完成的是：看招牌、导视牌、地图图标、店铺门头、楼层标识，然后做辨认或匹配。",
      "成功标准应该很具体：能认出 6-8 个高频地点/商店名称，能把图和词对上，能用“这是……”说出来。"
    );
    materials.push(
      "最适合的材料不是长语篇，而是：商店招牌照片、商场导视图、地图截图、校园或街区标识、门口指示牌。",
      "可以准备一页 6-8 张真实图片：医院、银行、书店、超市、饭店、地铁站、药店、咖啡店。",
      sampleTitle ? `当前原始示例“${sampleTitle}”可以作为热身，但主任务最好换成更清楚的标识图片页。` : "主任务建议做成一页图卡，而不是纯文字。"
    );
    studentTasks.push(
      "任务 1：看图片，把 8 个标识和地点名称连线。",
      "任务 2：听老师说“我想买药 / 我想坐地铁 / 我想买书”，学生指出最合适的地点。",
      "任务 3：两人一组，一人指图片问“这是哪里？”，另一人回答“这是……”。",
      "任务 4：给一张简易街区图，让学生圈出老师说到的商店或地点。"
    );
    outputs.push(
      "学生口头输出 1：这是书店。 / 这是银行。 / 这是超市。",
      "学生口头输出 2：如果我想买水果，我去超市。 / 如果我想买药，我去药店。",
      "学生书写输出：把 6 个地点名称写到对应图片或地图上。",
      isNovice ? "这一条不需要硬做 AP/IB/OPI 讨论；先把识别、配对、简单说出做好就够了。" : "如果要升级，可加入“你为什么去这里”这样的简短说明。"
    );
    teacherNotes.push(
      "这类 can-do 先教“认”和“配”，不要一上来就让学生长篇表达。",
      "图片一定要清楚，招牌文字要大，最好让学生先静态辨认，再加入听力指认。"
    );
    return { analysis, materials, studentTasks, outputs, teacherNotes };
  }

  if (/宣传册|海报|广告|招聘/.test(canDo)) {
    analysis.push(
      `这条 can-do 的核心是：学生能不能从宣传材料里抓出关键信息，而不是泛泛谈“${anchor}”。`,
      "学生至少要能指出：对象是谁、要求是什么、时间地点是什么、有没有条件限制。",
      "成功标准应落在“找信息 + 复述信息 + 做简单比较”三步。"
    );
    materials.push(
      "最适合的材料是：招聘海报、课程宣传页、活动通知、志愿者招募广告、学校社团招新单。",
      "建议准备一长一短两份材料：一份做信息提取，一份做比较判断。",
      sampleTitle ? `当前示例“${sampleTitle}”可直接作为第一份材料，再补一张同类海报做比较。` : "可以先用一张真实宣传海报做热身。"
    );
    studentTasks.push(
      "任务 1：学生圈出宣传材料里的 4 个关键信息：对象、要求、时间、地点。",
      "任务 2：学生两人一组，用“这个活动适合……，因为……”做简单判断。",
      "任务 3：给两张宣传材料，让学生说哪一张更适合自己，并说明理由。",
      "任务 4：把海报内容改写成 3 句口头介绍。"
    );
    outputs.push(
      "口语题：请用 30-45 秒介绍这张宣传材料的主要内容。",
      "比较题：这两张宣传材料哪一张更适合高中生/大学生？为什么？",
      isMid ? "写作题：请写一段简短说明，介绍你会不会参加这个活动或申请这个职位。" : "写作题：请写 2-3 句，说明这张海报在说什么。"
    );
    teacherNotes.push(
      "这条 can-do 最适合做“圈信息 + 复述 + 选择”三步，不要空讲职业理想或社会大主题。",
      "如果学生水平较高，再往 AP/IB/OPI 方向加“你为什么这样判断”或“如果是你，你会不会选”。"
    );
    return { analysis, materials, studentTasks, outputs, teacherNotes };
  }

  if (isNovice) {
    analysis.push(
      `这条 can-do 的重点是让学生完成一个非常具体的小动作，而不是展开大主题讨论。`,
      "先判断学生是要“认出”“听懂”“指出”“填写”还是“简单说出”，再决定任务形式。",
      "对 Novice 层级，成功标准应该短、清楚、可观察。"
    );
    materials.push(
      `围绕“${anchor}”，优先用图片卡、信息卡、配对表、地图、小表格、短标签。`,
      "材料最好一眼能看懂，不要一开始就上长段文字。",
      coreWords.length ? `可优先放进这些高频词：${coreWords.slice(0, 6).join("、")}。` : "先保证学生能认出关键词，再进入任务。"
    );
    studentTasks.push(
      "任务 1：图片或词语配对。",
      "任务 2：听到一个词或短句后指图。",
      "任务 3：完成一个小表格或勾选题。",
      "任务 4：用 1-2 句做最基本的口头输出。"
    );
    outputs.push(
      "可直接发学生的输出：这是…… / 我喜欢…… / 我去…… / 我看到……",
      "如果要升级，只加一个理由或一个地点，不要一次加太多句法负担。"
    );
    teacherNotes.push(
      "Novice 层级最怕任务过大。请先做识别或配对，再做一句话输出。",
      "老师备课时，先准备图片和词卡，往往比准备长语篇更有效。"
    );
    return { analysis, materials, studentTasks, outputs, teacherNotes };
  }

  const oPIStem = buildOpiStem(anchor, mode);
  const promptSet = buildDiscussionPrompts(anchor, mode, coreWords);
  return {
    analysis: [
      `这条 can-do 更适合围绕“${anchor}”设计信息提取、比较判断和观点输出。`,
      `学生完成时不只要说内容，还要补理由、细节或比较。`,
      `如果要拉开等级差异，就看学生能不能从“说一点”推进到“说得具体”。`,
    ],
    materials: buildCorpusHints(anchor, mode, sampleTitle),
    studentTasks: [
      "任务 1：读/听材料后先抓关键点。",
      "任务 2：和同伴比较、回应或追问。",
      "任务 3：把材料信息转成自己的口头或书面表达。",
    ],
    outputs: [
      ...promptSet.discussion,
      ...promptSet.output,
      `OPI 追问：${oPIStem}`,
    ],
    teacherNotes: [
      `不要把 can-do 直接变成机械任务链。先想清楚：学生要围绕“${anchor}”表达信息、观点，还是个人经历。`,
      "如果你要快速备课，先找 1 份真实语料 + 2 个讨论题 + 1 个追问，就已经够用。",
    ],
  };
}

function buildOpiStem(anchor, mode) {
  const byMode = {
    理解诠释: `先让学生概述材料内容，再连续追问“你怎么知道”“哪个细节最重要”“如果换一个人看这份材料，理解会不会不同”。`,
    人际沟通: `把“${anchor}”改成连续互动：先回答，再补细节，再比较，再说明自己的态度或选择。`,
    表达演示: `要求学生先做简短陈述，再补充例子、解释原因，最后回应一个反问或不同意见。`,
  };
  return byMode[mode] || `把这条 can-do 改成连续追问，逼学生补充原因、细节、例子和比较。`;
}

function resolveProviderConfig() {
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase().trim() || inferProviderFromEnv();
  const key =
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.KIMI_API_KEY ||
    process.env.MOONSHOT_API_KEY ||
    process.env.SILICONFLOW_API_KEY;

  const presets = {
    openai: {
      baseURL: "https://api.openai.com/v1",
      model: process.env.LLM_MODEL || "gpt-5-mini",
      imageEnabled: true,
      imageModel: process.env.IMAGE_MODEL || "gpt-image-1",
    },
    deepseek: {
      baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com/v1",
      model: process.env.LLM_MODEL || "deepseek-chat",
      imageEnabled: false,
      imageModel: "",
    },
    kimi: {
      baseURL: process.env.LLM_BASE_URL || process.env.KIMI_BASE_URL || process.env.MOONSHOT_BASE_URL || "https://api.moonshot.ai/v1",
      model: process.env.LLM_MODEL || "kimi-k2-0711-preview",
      imageEnabled: false,
      imageModel: "",
    },
    siliconflow: {
      baseURL: process.env.LLM_BASE_URL || "https://api.siliconflow.cn/v1",
      model: process.env.LLM_MODEL || "deepseek-ai/DeepSeek-V3",
      imageEnabled: false,
      imageModel: "",
    },
    custom: {
      baseURL: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
      model: process.env.LLM_MODEL || "gpt-5-mini",
      imageEnabled: Boolean(process.env.IMAGE_MODEL),
      imageModel: process.env.IMAGE_MODEL || "",
    },
  };

  const selected = presets[provider] || presets.openai;

  return {
    provider: provider || "openai",
    apiKey: key,
    ...selected,
  };
}

function inferProviderFromEnv() {
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  if (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY) return "kimi";
  if (process.env.SILICONFLOW_API_KEY) return "siliconflow";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "openai";
}
