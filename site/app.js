const els = {
  heroStats: document.getElementById("heroStats"),
  level: document.getElementById("levelFilter"),
  theme: document.getElementById("themeFilter"),
  subtheme: document.getElementById("subthemeFilter"),
  topic: document.getElementById("topicFilter"),
  search: document.getElementById("searchInput"),
  resultMeta: document.getElementById("resultMeta"),
  activePath: document.getElementById("activePath"),
  resultsList: document.getElementById("resultsList"),
  detailTitle: document.getElementById("detailTitle"),
  detailPath: document.getElementById("detailPath"),
  detailLevel: document.getElementById("detailLevel"),
  detailMode: document.getElementById("detailMode"),
  coreWords: document.getElementById("coreWords"),
  relatedWords: document.getElementById("relatedWords"),
  sampleText: document.getElementById("sampleText"),
  comparisonList: document.getElementById("comparisonList"),
  generateBtn: document.getElementById("generateBtn"),
  generatedExamples: document.getElementById("generatedExamples"),
  generatedActivity: document.getElementById("generatedActivity"),
  expertDebate: document.getElementById("expertDebate"),
  topicImage: document.getElementById("topicImage"),
  studioNote: document.getElementById("studioNote"),
};

const state = {
  dataset: null,
  entries: [],
  level: "",
  themeCode: "",
  subthemeCode: "",
  topicCode: "",
  search: "",
  selectedId: "",
  generatedPack: null,
  health: null,
};

init();

async function init() {
  const [health, entriesResp] = await Promise.all([
    fetchJson("/api/health"),
    fetchJson("/api/entries"),
  ]);

  state.health = health;
  state.entries = entriesResp.entries;
  state.dataset = {
    summary: health.summary,
    entries: entriesResp.entries,
  };

  renderHeroStats();
  populateFilters();
  bindEvents();
  syncSelectionWithFilters();
  render();
}

function bindEvents() {
  const fieldMap = {
    level: "level",
    theme: "themeCode",
    subtheme: "subthemeCode",
    topic: "topicCode",
  };

  Object.entries(fieldMap).forEach(([key, field]) => {
    els[key].addEventListener("change", (event) => {
      state[field] = event.target.value;
      if (key === "theme") {
        state.subthemeCode = "";
        state.topicCode = "";
      }
      if (key === "subtheme") {
        state.topicCode = "";
      }
      state.generatedPack = null;
      populateFilters();
      syncSelectionWithFilters();
      render();
    });
  });

  els.search.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    syncSelectionWithFilters();
    render();
  });

  els.generateBtn.addEventListener("click", generateLessonPack);
}

function renderHeroStats() {
  const summary = state.dataset.summary;
  const cards = [
    ["等级层级", summary.levels.length],
    ["主题", summary.themeCount],
    ["话题", summary.topicCount],
    ["材料条目", summary.entryCount],
  ];

  els.heroStats.innerHTML = cards
    .map(
      ([label, value]) => `
        <div class="hero-stat">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `
    )
    .join("");
}

function populateFilters() {
  fillSelect(
    els.level,
    state.dataset.summary.levels.map((level) => ({ value: level, label: level })),
    "全部等级",
    state.level
  );

  fillSelect(
    els.theme,
    uniqueBy(
      state.entries.map((entry) => ({
        value: entry.themeCode,
        label: [entry.themeCode, entry.themeName].filter(Boolean).join(" "),
      })),
      "value"
    ).filter((item) => item.value),
    "全部主题",
    state.themeCode
  );

  fillSelect(
    els.subtheme,
    uniqueBy(
      state.entries
        .filter((entry) => !state.themeCode || entry.themeCode === state.themeCode)
        .map((entry) => ({
          value: entry.subthemeCode,
          label: [entry.subthemeCode, entry.subthemeName].filter(Boolean).join(" "),
        })),
      "value"
    ).filter((item) => item.value),
    "全部子主题",
    state.subthemeCode
  );

  fillSelect(
    els.topic,
    uniqueBy(
      state.entries
        .filter((entry) => !state.themeCode || entry.themeCode === state.themeCode)
        .filter((entry) => !state.subthemeCode || entry.subthemeCode === state.subthemeCode)
        .map((entry) => ({
          value: entry.topicCode,
          label: [entry.topicCode, entry.topicName].filter(Boolean).join(" "),
        })),
      "value"
    ).filter((item) => item.value),
    "全部话题",
    state.topicCode
  );
}

function syncSelectionWithFilters() {
  const filtered = getFilteredEntries();
  if (!filtered.length) {
    state.selectedId = "";
    return;
  }
  if (!filtered.some((entry) => entry.id === state.selectedId)) {
    state.selectedId = filtered[0].id;
    state.generatedPack = null;
  }
}

function render() {
  const filtered = getFilteredEntries();
  const selected = filtered.find((entry) => entry.id === state.selectedId) || filtered[0] || null;

  els.resultMeta.textContent = `结果 ${filtered.length} 条`;
  els.activePath.textContent = buildPath(selected);
  renderResultList(filtered, selected);
  renderDetail(selected);
}

function getFilteredEntries() {
  const needle = state.search.toLowerCase();
  return [...state.entries]
    .filter((entry) => {
      if (state.level && entry.level !== state.level) return false;
      if (state.themeCode && entry.themeCode !== state.themeCode) return false;
      if (state.subthemeCode && entry.subthemeCode !== state.subthemeCode) return false;
      if (state.topicCode && entry.topicCode !== state.topicCode) return false;
      if (!needle) return true;

      return [
        entry.canDo,
        entry.mode,
        entry.topicRaw,
        entry.coreWords,
        entry.relatedWords,
        entry.sample,
        entry.themeName,
        entry.subthemeName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .sort(compareEntries);
}

function renderResultList(entries, selected) {
  if (!entries.length) {
    els.resultsList.innerHTML = `<div class="empty-copy">没有匹配结果。可以放宽筛选条件，或只选一个话题查看跨等级材料。</div>`;
    return;
  }

  els.resultsList.innerHTML = entries
    .map(
      (entry) => `
        <article class="result-card ${selected && selected.id === entry.id ? "active" : ""}" data-entry-id="${escapeAttr(entry.id)}">
          <span class="mini-badge">${escapeHtml(entry.level)}</span>
          <h4>${escapeHtml(entry.canDo)}</h4>
          <p>${escapeHtml([entry.topicCode && `${entry.topicCode} ${entry.topicName}`, entry.mode].filter(Boolean).join(" / "))}</p>
        </article>
      `
    )
    .join("");

  Array.from(els.resultsList.querySelectorAll("[data-entry-id]")).forEach((node) => {
    node.addEventListener("click", () => {
      state.selectedId = node.dataset.entryId;
      state.generatedPack = null;
      render();
    });
  });
}

function renderDetail(entry) {
  if (!entry) {
    els.detailTitle.textContent = "没有找到匹配条目";
    els.detailPath.textContent = "请调整筛选条件。";
    els.detailLevel.textContent = "";
    els.detailMode.textContent = "";
    els.coreWords.textContent = "";
    els.relatedWords.textContent = "";
    els.sampleText.textContent = "";
    els.comparisonList.innerHTML = `<div class="empty-copy">暂无可对比材料。</div>`;
    els.topicImage.removeAttribute("src");
    return;
  }

  els.detailTitle.textContent = entry.canDo;
  els.detailPath.textContent = [entry.themeCode && `${entry.themeCode} ${entry.themeName}`, entry.subthemeCode && `${entry.subthemeCode} ${entry.subthemeName}`, entry.topicCode && `${entry.topicCode} ${entry.topicName}`]
    .filter(Boolean)
    .join(" / ");
  els.detailLevel.textContent = entry.level;
  els.detailMode.textContent = entry.mode || "未标注模态";
  els.coreWords.textContent = entry.coreWords || "暂无";
  els.relatedWords.textContent = entry.relatedWords || "暂无";
  els.sampleText.textContent = entry.sample || "暂无";

  const comparison = state.entries
    .filter((item) => item.topicCode === entry.topicCode)
    .sort(compareEntries);

  els.comparisonList.innerHTML = comparison.length
    ? comparison
        .map(
          (item) => `
            <article class="comparison-card">
              <h4>${escapeHtml(item.level)}</h4>
              <p>${escapeHtml(item.canDo)}</p>
            </article>
          `
        )
        .join("")
    : `<div class="empty-copy">当前话题暂无跨等级可比材料。</div>`;

  const image = state.generatedPack?.focusEntry?.id === entry.id ? state.generatedPack.image : null;
  els.topicImage.src = image?.dataUrl || buildPreviewGradient(entry);
  els.topicImage.alt = image?.alt || `${entry.topicName || entry.subthemeName} 教学预览图`;

  renderGeneratedPanels(entry);
  updateStudioNote();
}

function renderGeneratedPanels(entry) {
  if (!entry || !state.generatedPack || state.generatedPack.focusEntry.id !== entry.id) {
    els.generatedExamples.innerHTML = `<div class="empty-copy">选择条目后点击按钮生成。</div>`;
    els.generatedActivity.innerHTML = `<div class="empty-copy">这里会生成导入、输入、输出和分层建议。</div>`;
    els.expertDebate.innerHTML = `<div class="empty-copy">生成后会在这里看到 AP/IB、OPI、大学中文三位专家的不同观点。</div>`;
    return;
  }

  els.generatedExamples.innerHTML = (state.generatedPack.examples || [])
    .map((item) => {
      const title = typeof item === "string" ? "扩展示例" : item.title;
      const skillFocus = typeof item === "string" ? "" : item.skillFocus;
      const text = typeof item === "string" ? item : item.text;
      return `
        <div class="generated-item">
          <div><span class="muted-label">${escapeHtml(title)}</span>${skillFocus ? ` <span class="mini-badge">${escapeHtml(skillFocus)}</span>` : ""}</div>
          <div style="margin-top: 8px;">${escapeHtml(text)}</div>
        </div>
      `;
    })
    .join("");

  const activity = state.generatedPack.activity || {};
  els.generatedActivity.innerHTML = `
    <div class="generated-item"><span class="muted-label">任务名称：</span>${escapeHtml(activity.title || "未生成")}</div>
    <div class="generated-item"><span class="muted-label">Task：</span>${escapeHtml(activity.task || "")}</div>
    <div class="generated-item"><span class="muted-label">热身：</span>${escapeHtml(activity.warmup || "")}</div>
    <div class="generated-item"><span class="muted-label">输入：</span>${escapeHtml(activity.input || "")}</div>
    <div class="generated-item"><span class="muted-label">Teacher Script：</span>${escapeHtml(activity.teacherScript || "")}</div>
    <div class="generated-item"><span class="muted-label">输出：</span>${escapeHtml(activity.output || "")}</div>
    <div class="generated-item"><span class="muted-label">Student Output：</span>${escapeHtml(activity.studentOutput || "")}</div>
    <div class="generated-item"><span class="muted-label">Extension：</span>${escapeHtml(activity.extension || "")}</div>
    <div class="generated-item"><span class="muted-label">分层：</span>${escapeHtml(activity.differentiation || "")}</div>
    <div class="generated-item"><span class="muted-label">评估：</span>${escapeHtml(activity.assessment || "")}</div>
  `;

  const debate = state.generatedPack.expertDebate || [];
  els.expertDebate.innerHTML = debate
    .map((item) => {
      const concern = item.concern || item.stance || "";
      const recommendation = item.recommendation || item.takeaway || "";
      const classroomMove = item.classroomMove || "";
      return `
        <article class="debate-card-item">
          <h4>${escapeHtml(item.expert)}</h4>
          <p><span class="muted-label">关注点：</span>${escapeHtml(concern)}</p>
          <p><span class="muted-label">建议：</span>${escapeHtml(recommendation)}</p>
          <p><span class="muted-label">课堂动作：</span>${escapeHtml(classroomMove)}</p>
        </article>
      `;
    })
    .join("");
}

async function generateLessonPack() {
  const selected = state.entries.find((entry) => entry.id === state.selectedId);
  if (!selected) return;

  els.generateBtn.disabled = true;
  els.generateBtn.textContent = "生成中...";

  try {
    const pack = await fetchJson("/api/generate/lesson-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, topicCode: selected.topicCode, level: selected.level }),
    });
    state.generatedPack = pack;
    render();
  } catch (error) {
    els.generatedExamples.innerHTML = `<div class="empty-copy">生成失败：${escapeHtml(error.message || String(error))}</div>`;
  } finally {
    els.generateBtn.disabled = false;
    els.generateBtn.textContent = "生成更多例句与专家建议";
  }
}

function updateStudioNote() {
  const configured = state.health?.openaiConfigured;
  const provider = state.health?.provider?.provider || "fallback";
  const source = state.generatedPack?.source;
  if (source === "openai") {
    els.studioNote.textContent = `当前结果由 ${provider} 兼容 API 实时生成，包含扩展示例、任务链、三专家圆桌和配图/预览图。`;
    return;
  }
  if (!configured) {
    els.studioNote.textContent = "当前为本地演示模式：还没有检测到可用的 LLM_API_KEY / DeepSeek / Kimi / 硅基流动密钥，系统会先生成可展示的回退内容。";
    return;
  }
  els.studioNote.textContent = "点击按钮生成更多样例语料、配图与教师视角建议。";
}

function buildPath(entry) {
  if (!entry) return "当前浏览：暂无结果";
  return `当前浏览：${[entry.level, entry.themeCode && `${entry.themeCode} ${entry.themeName}`, entry.subthemeCode && `${entry.subthemeCode} ${entry.subthemeName}`, entry.topicCode && `${entry.topicCode} ${entry.topicName}`]
    .filter(Boolean)
    .join(" / ")}`;
}

function compareEntries(a, b) {
  const order = state.dataset.summary.levels;
  return (
    order.indexOf(a.level) - order.indexOf(b.level) ||
    a.themeCode.localeCompare(b.themeCode) ||
    a.subthemeCode.localeCompare(b.subthemeCode) ||
    a.topicCode.localeCompare(b.topicCode) ||
    a.canDo.localeCompare(b.canDo)
  );
}

function fillSelect(select, options, placeholder, selectedValue) {
  select.innerHTML = [`<option value="">${placeholder}</option>`]
    .concat(options.map((item) => `<option value="${escapeAttr(item.value)}">${escapeHtml(item.label)}</option>`))
    .join("");
  select.value = selectedValue || "";
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item[key])) return false;
    seen.add(item[key]);
    return true;
  });
}

function buildPreviewGradient(entry) {
  const title = sanitizeSvg(entry.topicName || entry.subthemeName || "Teaching Visual");
  const subtitle = sanitizeSvg(entry.level || "");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#f6e3be"/>
          <stop offset="100%" stop-color="#dcece7"/>
        </linearGradient>
      </defs>
      <rect width="900" height="900" rx="40" fill="url(#bg)"/>
      <circle cx="180" cy="170" r="110" fill="#d8894a" opacity="0.22"/>
      <circle cx="720" cy="720" r="150" fill="#2f7c79" opacity="0.18"/>
      <text x="70" y="120" font-family="Microsoft YaHei, sans-serif" font-size="28" fill="#9d512f">Teaching Preview</text>
      <text x="70" y="240" font-family="Microsoft YaHei, sans-serif" font-size="60" font-weight="700" fill="#1b1611">${title}</text>
      <text x="70" y="305" font-family="Microsoft YaHei, sans-serif" font-size="30" fill="#2b7973">${subtitle}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function sanitizeSvg(value) {
  return String(value ?? "").replace(/[<>&"]/g, "");
}
