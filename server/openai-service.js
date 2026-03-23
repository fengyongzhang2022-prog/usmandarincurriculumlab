import OpenAI from "openai";
import { buildFallbackImage, buildFallbackLessonPack, tokenizeWords } from "./content-engine.js";

const providerConfig = resolveProviderConfig();
const client = providerConfig.apiKey
  ? new OpenAI({
      apiKey: providerConfig.apiKey,
      baseURL: providerConfig.baseURL,
    })
  : null;

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

  const prompt = [
    "You are an expert Chinese curriculum design assistant for U.S. K-16 teachers.",
    "Return strict JSON only.",
    "Create a teacher-ready mini lesson pack aligned to the provided ACTFL entry.",
    "Audience: AP Chinese, IB Chinese, ACTFL OPI prep, and university Chinese.",
    "Requirements:",
    "- Write all teacher-facing content in Simplified Chinese, but keep key assessment labels like AP, IB, OPI in English.",
    "- Respect the level and topic. Do not use vocabulary far beyond the target level unless marked as stretch support.",
    "- The output must feel like polished classroom material, similar to sample-based Chinese teaching packets, not just loose sentences.",
    "- Produce 4 fresh teaching-ready sample blocks in the style of the source sample, not copied from it.",
    "- At least one block must be a mini dialogue, one must be a teacher script, and one must be a short listening or output task.",
    "- Produce a short activity sequence with these fields: task, warmup, input, teacherScript, output, studentOutput, extension, differentiation, assessment.",
    "- Produce an expert roundtable with exactly 3 experts: AP/IB课程设计师, ACTFL/OPI口语评估教练, 大学中文项目主任.",
    "- Each expert gives one concern, one recommendation, and one classroom move.",
    `Entry JSON: ${JSON.stringify(entry)}`,
    "JSON schema:",
    "{\"examples\":[{\"title\":\"\",\"text\":\"\",\"skillFocus\":\"\"}],\"activity\":{\"title\":\"\",\"task\":\"\",\"warmup\":\"\",\"input\":\"\",\"teacherScript\":\"\",\"output\":\"\",\"studentOutput\":\"\",\"extension\":\"\",\"differentiation\":\"\",\"assessment\":\"\"},\"expertDebate\":[{\"expert\":\"\",\"concern\":\"\",\"recommendation\":\"\",\"classroomMove\":\"\"}]}",
  ].join("\n");

  const response = await client.responses.create({
    model: providerConfig.model,
    input: prompt,
  });

  const parsed = safeJsonParse(response.output_text);
  if (!parsed) {
    return buildFallbackLessonPack(entry);
  }

  return {
    source: "openai",
    focusEntry: entry,
    examples: parsed.examples || [],
    activity: parsed.activity,
    expertDebate: parsed.expertDebate || [],
    image: await generateTopicImage(entry),
  };
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
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}$/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
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
