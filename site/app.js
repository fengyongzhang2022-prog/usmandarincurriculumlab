const els = {
  navTabs: Array.from(document.querySelectorAll(".nav-tab")),
  views: Array.from(document.querySelectorAll(".view")),
  homeLevelGrid: document.getElementById("homeLevelGrid"),
  featuredGrid: document.getElementById("featuredGrid"),
  featuredPrevBtn: document.getElementById("featuredPrevBtn"),
  featuredNextBtn: document.getElementById("featuredNextBtn"),
  messageName: document.getElementById("messageName"),
  messageEmail: document.getElementById("messageEmail"),
  messageText: document.getElementById("messageText"),
  messageSubmitBtn: document.getElementById("messageSubmitBtn"),
  messageStatus: document.getElementById("messageStatus"),
  level: document.getElementById("levelFilter"),
  mode: document.getElementById("modeFilter"),
  theme: document.getElementById("themeFilter"),
  subtheme: document.getElementById("subthemeFilter"),
  topic: document.getElementById("topicFilter"),
  search: document.getElementById("searchInput"),
  resultMeta: document.getElementById("resultMeta"),
  activePath: document.getElementById("activePath"),
  resultsList: document.getElementById("resultsList"),
  detailTitleZh: document.getElementById("detailTitleZh"),
  detailTitleEn: document.getElementById("detailTitleEn"),
  detailMeta: document.getElementById("detailMeta"),
  sampleMediaStrip: document.getElementById("sampleMediaStrip"),
  coreWords: document.getElementById("coreWords"),
  relatedWords: document.getElementById("relatedWords"),
  levelSharedWords: document.getElementById("levelSharedWords"),
  sampleText: document.getElementById("sampleText"),
  comparisonList: document.getElementById("comparisonList"),
  vocabSummary: document.getElementById("vocabSummary"),
  vocabQueryInput: document.getElementById("vocabQueryInput"),
  vocabSearchBtn: document.getElementById("vocabSearchBtn"),
  vocabSearchResults: document.getElementById("vocabSearchResults"),
  passageInput: document.getElementById("passageInput"),
  passageAnalyzeBtn: document.getElementById("passageAnalyzeBtn"),
  passageAnalysis: document.getElementById("passageAnalysis"),
  grammarLevelFilter: document.getElementById("grammarLevelFilter"),
  grammarLevelBtn: document.getElementById("grammarLevelBtn"),
  grammarLevelResults: document.getElementById("grammarLevelResults"),
  grammarQueryInput: document.getElementById("grammarQueryInput"),
  grammarQueryBtn: document.getElementById("grammarQueryBtn"),
  grammarQueryResults: document.getElementById("grammarQueryResults"),
  studioNote: document.getElementById("studioNote"),
  assistantTabs: Array.from(document.querySelectorAll("[data-assistant-tab]")),
  assistantWordInput: document.getElementById("assistantWordInput"),
  assistantWordLevel: document.getElementById("assistantWordLevel"),
  assistantWordBtn: document.getElementById("assistantWordBtn"),
  assistantWordOutput: document.getElementById("assistantWordOutput"),
  assistantSynonymsInput: document.getElementById("assistantSynonymsInput"),
  assistantSynonymsLevel: document.getElementById("assistantSynonymsLevel"),
  assistantSynonymsBtn: document.getElementById("assistantSynonymsBtn"),
  assistantSynonymsOutput: document.getElementById("assistantSynonymsOutput"),
  assistantCanDoLevel: document.getElementById("assistantCanDoLevel"),
  assistantCanDoMode: document.getElementById("assistantCanDoMode"),
  assistantCanDoSelect: document.getElementById("assistantCanDoSelect"),
  assistantCanDoBtn: document.getElementById("assistantCanDoBtn"),
  assistantCanDoOutput: document.getElementById("assistantCanDoOutput"),
  assistantPanes: {
    word: document.getElementById("assistantPaneWord"),
    synonyms: document.getElementById("assistantPaneSynonyms"),
    cando: document.getElementById("assistantPaneCanDo"),
  },
};

const state = {
  health: null,
  entries: [],
  level: "Intermediate Mid",
  mode: "理解诠释",
  themeCode: "T1",
  subthemeCode: "T1.1",
  topicCode: "T1.1.1",
  search: "",
  selectedId: "Intermediate Mid|T1|T1.1|T1.1.1|3",
  currentView: "homeView",
  assistantTab: "word",
};

init();

async function init() {
  const [health, entriesResp] = await Promise.all([
    fetchJson("/api/health"),
    fetchJson("/api/entries"),
  ]);

  state.health = health;
  state.entries = entriesResp.entries.map(normalizeEntryMode);
  state.health.modes = ["理解诠释", "人际沟通", "表达演示"];
  applyDefaultOutlineSelection();

  els.vocabSummary.textContent = `当前收录 ${health.vocab?.count || 0} 个词条，可用于单词查询与整篇课文词汇分析。`;
  populateGrammarFilters();
  populateAssistantFilters();

  bindEvents();
  renderHomepage();
  populateFilters();
  syncSelection();
  render();
}

function bindEvents() {
  for (const tab of els.navTabs) {
    tab.addEventListener("click", () => {
      state.currentView = tab.dataset.view;
      renderViews();
    });
  }

  const fieldMap = {
    level: "level",
    mode: "mode",
    theme: "themeCode",
    subtheme: "subthemeCode",
    topic: "topicCode",
  };

  for (const [key, field] of Object.entries(fieldMap)) {
    els[key].addEventListener("change", (event) => {
      state[field] = event.target.value;
      if (key === "theme") {
        state.subthemeCode = "";
        state.topicCode = "";
      }
      if (key === "subtheme") {
        state.topicCode = "";
      }
      populateFilters();
      syncSelection();
      render();
    });
  }

  if (els.search) {
    els.search.addEventListener("input", (event) => {
      state.search = event.target.value.trim();
      syncSelection();
      render();
    });
  }

  els.vocabSearchBtn.addEventListener("click", runVocabSearch);
  els.passageAnalyzeBtn.addEventListener("click", runPassageAnalysis);
  els.grammarLevelBtn?.addEventListener("click", runGrammarLevelSearch);
  els.grammarQueryBtn?.addEventListener("click", runGrammarQuerySearch);
  els.messageSubmitBtn.addEventListener("click", submitMessage);
  els.featuredPrevBtn.addEventListener("click", () => {
    const distance = Math.max(els.featuredGrid.clientWidth * 0.88, 320);
    els.featuredGrid.scrollBy({ left: -distance, behavior: "smooth" });
  });
  els.featuredNextBtn.addEventListener("click", () => {
    const distance = Math.max(els.featuredGrid.clientWidth * 0.88, 320);
    els.featuredGrid.scrollBy({ left: distance, behavior: "smooth" });
  });

  for (const node of document.querySelectorAll("[data-jump-view]")) {
    node.addEventListener("click", () => {
      state.currentView = node.dataset.jumpView;
      renderViews();
    });
  }

  for (const tab of els.assistantTabs) {
    tab.addEventListener("click", () => {
      state.assistantTab = tab.dataset.assistantTab;
      renderAssistantTabs();
    });
  }

  els.assistantWordBtn?.addEventListener("click", runAssistantWord);
  els.assistantSynonymsBtn?.addEventListener("click", runAssistantSynonyms);
  els.assistantCanDoBtn?.addEventListener("click", runAssistantCanDo);
  els.assistantCanDoLevel?.addEventListener("change", populateAssistantCanDoOptions);
  els.assistantCanDoMode?.addEventListener("change", populateAssistantCanDoOptions);
}

function renderViews() {
  for (const tab of els.navTabs) {
    tab.classList.toggle("is-active", tab.dataset.view === state.currentView);
  }
  for (const view of els.views) {
    view.classList.toggle("is-active", view.id === state.currentView);
  }
  renderAssistantTabs();
}

function populateFilters() {
  const levelOptions = uniqueBy(state.entries.map((entry) => ({ value: entry.level, label: entry.level })), "value");
  const modeOptions = (state.health?.modes || []).map((mode) => ({ value: mode, label: mode }));
  const themeOptions = uniqueBy(
    state.entries.map((entry) => ({
      value: entry.themeCode,
      label: [entry.themeCode, entry.themeName].filter(Boolean).join(" "),
    })),
    "value"
  ).filter((item) => item.value);
  const subthemeOptions = uniqueBy(
    state.entries
      .filter((entry) => !state.themeCode || entry.themeCode === state.themeCode)
      .map((entry) => ({
        value: entry.subthemeCode,
        label: [entry.subthemeCode, entry.subthemeName].filter(Boolean).join(" "),
      })),
    "value"
  ).filter((item) => item.value);
  const topicOptions = uniqueBy(
    state.entries
      .filter((entry) => !state.themeCode || entry.themeCode === state.themeCode)
      .filter((entry) => !state.subthemeCode || entry.subthemeCode === state.subthemeCode)
      .map((entry) => ({
        value: entry.topicCode,
        label: entry.topicName ? `${entry.topicCode} ${entry.topicName}` : entry.topicCode,
      })),
    "value"
  ).filter((item) => item.value);

  fillSelect(els.level, levelOptions, "全部等级", state.level);
  fillSelect(els.mode, modeOptions, "全部模态", state.mode);
  fillSelect(els.theme, themeOptions, "全部主题", state.themeCode);
  fillSelect(els.subtheme, subthemeOptions, "全部子主题", state.subthemeCode);
  fillSelect(els.topic, topicOptions, "全部话题", state.topicCode);
}

function populateAssistantFilters() {
  const levelOptions = uniqueBy(state.entries.map((entry) => ({ value: entry.level, label: entry.level })), "value");
  const modeOptions = (state.health?.modes || []).map((mode) => ({ value: mode, label: mode }));

  fillSelect(els.assistantWordLevel, levelOptions, "不限等级", "");
  fillSelect(els.assistantSynonymsLevel, levelOptions, "不限等级", "");
  fillSelect(els.assistantCanDoLevel, levelOptions, "不限等级", "");
  fillSelect(els.assistantCanDoMode, modeOptions, "不限模态", "");
  populateAssistantCanDoOptions();
}

function populateAssistantCanDoOptions() {
  const level = els.assistantCanDoLevel?.value || "";
  const mode = els.assistantCanDoMode?.value || "";
  const options = state.entries
    .filter((entry) => !isFunctionalPseudoEntry(entry))
    .filter((entry) => (!level || entry.level === level))
    .filter((entry) => (!mode || entry.mode === mode))
    .slice(0, 120)
    .map((entry) => {
      const bilingual = splitCanDo(entry.canDo);
      return {
        value: entry.id,
        label: shortChineseTitle(bilingual.zh || entry.canDo),
      };
    });

  fillSelect(els.assistantCanDoSelect, options, "请选择一条能做描述", "");
}

function renderAssistantTabs() {
  for (const tab of els.assistantTabs) {
    tab.classList.toggle("is-active", tab.dataset.assistantTab === state.assistantTab);
  }
  for (const [key, pane] of Object.entries(els.assistantPanes)) {
    pane?.classList.toggle("is-active", key === state.assistantTab);
  }
}

function getFilteredEntries() {
  const needle = state.search.toLowerCase();
  return dedupeOutlineEntries([...state.entries]
    .filter((entry) => {
      if (isFunctionalPseudoEntry(entry)) return false;
      if (state.level && entry.level !== state.level) return false;
      if (state.mode && entry.mode !== state.mode) return false;
      if (state.themeCode && entry.themeCode !== state.themeCode) return false;
      if (state.subthemeCode && entry.subthemeCode !== state.subthemeCode) return false;
      if (state.topicCode && entry.topicCode !== state.topicCode) return false;
      if (!needle) return true;
      const haystack = [
        entry.canDo,
        entry.mode,
        entry.topicRaw,
        entry.coreWords,
        entry.relatedWords,
        entry.sample,
        entry.themeName,
        entry.subthemeName,
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    })
    .sort(compareEntries));
}

function syncSelection() {
  const filtered = getFilteredEntries();
  if (!filtered.length) {
    state.selectedId = "";
    return;
  }
  if (!filtered.some((entry) => entry.id === state.selectedId)) {
    state.selectedId = filtered[0].id;
  }
}

async function render() {
  renderViews();

  const filtered = getFilteredEntries();
  const selected = filtered.find((entry) => entry.id === state.selectedId) || filtered[0] || null;

  els.resultMeta.textContent = String(filtered.length);
  els.activePath.textContent = buildPath(selected);
  renderResultList(filtered, selected);
  await renderDetail(selected);
}

function renderHomepage() {
  const levels = state.health?.summary?.levels || [];
  els.homeLevelGrid.innerHTML = levels.map((level) => `
    <article class="level-card" data-level-jump="${escapeAttr(level)}">
      <h3>${escapeHtml(level)}</h3>
      <p>查看这个等级的 can-do、语篇与配套词语。</p>
    </article>
  `).join("");

  for (const card of els.homeLevelGrid.querySelectorAll("[data-level-jump]")) {
    card.addEventListener("click", () => {
      state.level = card.dataset.levelJump;
      state.mode = "";
      state.themeCode = "";
      state.subthemeCode = "";
      state.topicCode = "";
      state.search = "";
      populateFilters();
      syncSelection();
      state.currentView = "outlineView";
      render();
    });
  }

  const featured = pickFeaturedEntries(state.entries);
  els.featuredGrid.innerHTML = featured.map((entry) => {
    const bilingual = splitCanDo(entry.canDo);
    const teaser = entry.featuredSummary || extractSampleTitle(entry) || entry.topicName || bilingual.zh || entry.canDo;
    const image = entry.featuredImage || entry.sampleImages?.[0] || "";
    return `
      <article class="featured-card" data-entry-jump="${escapeAttr(entry.id)}">
        ${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(entry.topicName || "精选语篇")}">` : `<div class="sample-thumb"></div>`}
        <div class="featured-level">${escapeHtml(entry.level)}</div>
        <h3>${escapeHtml(entry.featuredTitle || teaser)}</h3>
        <p class="featured-title">${escapeHtml(shortChineseTitle(entry.featuredDescription || bilingual.zh || entry.canDo))}</p>
        <p class="featured-meta">${escapeHtml([entry.mode, entry.topicName || entry.topicCode].filter(Boolean).join(" / "))}</p>
      </article>
    `;
  }).join("");

  for (const card of els.featuredGrid.querySelectorAll("[data-entry-jump]")) {
    card.addEventListener("click", () => {
      state.selectedId = card.dataset.entryJump;
      const selected = state.entries.find((entry) => entry.id === state.selectedId);
      if (selected) {
        state.level = selected.level;
        state.mode = selected.mode || "";
        state.themeCode = selected.themeCode || "";
        state.subthemeCode = selected.subthemeCode || "";
        state.topicCode = selected.topicCode || "";
        state.search = "";
        populateFilters();
      }
      state.currentView = "outlineView";
      render();
    });
  }
}

function renderResultList(entries, selected) {
  if (!entries.length) {
    els.resultsList.innerHTML = `<div class="empty-copy">没有匹配结果。</div>`;
    return;
  }

  els.resultsList.innerHTML = entries.map((entry) => {
    const bilingual = splitCanDo(entry.canDo);
    return `
      <article class="result-card ${selected?.id === entry.id ? "active" : ""}" data-entry-id="${escapeAttr(entry.id)}">
        <span class="mini-badge">${escapeHtml(entry.level)}</span>
        <h4>${escapeHtml(bilingual.zh || entry.canDo)}</h4>
        ${bilingual.en ? `<p class="result-english">${escapeHtml(cleanEnglishCanDo(bilingual.en))}</p>` : ""}
        <p class="result-meta">${escapeHtml([entry.mode, entry.topicCode && `${entry.topicCode} ${entry.topicName}`].filter(Boolean).join(" / "))}</p>
      </article>
    `;
  }).join("");

  for (const node of els.resultsList.querySelectorAll("[data-entry-id]")) {
    node.addEventListener("click", () => {
      state.selectedId = node.dataset.entryId;
      render();
    });
  }
}

async function renderDetail(entry) {
  if (!entry) {
    els.detailTitleZh.textContent = "请选择一个条目";
    els.detailTitleEn.textContent = "";
    els.detailMeta.textContent = "当前没有匹配结果。";
    renderTextBlock(els.coreWords, "");
    renderTextBlock(els.relatedWords, "");
    els.sampleText.innerHTML = `<div class="empty-copy">暂无语篇示例。</div>`;
    els.sampleMediaStrip.hidden = true;
    els.sampleMediaStrip.innerHTML = "";
    els.levelSharedWords.innerHTML = `<div class="empty-copy">暂无。</div>`;
    els.comparisonList.innerHTML = `<div class="empty-copy">暂无。</div>`;
    return;
  }

  const bilingual = splitCanDo(entry.canDo);
  els.detailTitleZh.textContent = bilingual.zh || entry.canDo;
  els.detailTitleEn.textContent = bilingual.en ? cleanEnglishCanDo(bilingual.en) : "";
  els.detailMeta.textContent = [entry.level, entry.mode, entry.themeCode && `${entry.themeCode} ${entry.themeName}`, entry.subthemeCode && `${entry.subthemeCode} ${entry.subthemeName}`, entry.topicCode && `${entry.topicCode} ${entry.topicName}`]
    .filter(Boolean)
    .join(" / ");

  renderTerms(els.coreWords, entry.coreWords);
  renderTerms(els.relatedWords, entry.relatedWords);

  renderSample(entry);
  renderComparison(entry);
  await renderLevelResources(entry.level);
  updateStudioNote();
}

function renderSample(entry) {
  els.sampleMediaStrip.innerHTML = "";
  els.sampleMediaStrip.hidden = true;

  let html = entry.sampleHtml || "";
  if (!html) {
    renderTextBlock(els.sampleText, entry.sample || "暂无语篇示例。");
    return;
  }

  html = html
    .replace(
      /<p>\s*(<a [^>]+>)?\s*(<img[^>]+class="embedded-media"[^>]*>)\s*([^<]{1,80})\s*(<\/a>)?\s*<\/p>/g,
      (_match, openAnchor = "", imgTag, trailingText = "", closeAnchor = "") => {
        const imageNode = `${openAnchor || ""}${imgTag}${closeAnchor || ""}`;
        const caption = trailingText.trim();
        return `${imageNode}${caption ? `<p class="sample-caption">${escapeHtml(caption)}</p>` : ""}`;
      }
    )
    .replace(/<p>\s*\[图片\]\s*<\/p>/g, "")
    .replace(/\[图片\]/g, "")
    .trim();

  els.sampleText.innerHTML = linkifyHtml(html) || `<div class="empty-copy">暂无语篇示例。</div>`;
}

function renderComparison(entry) {
  const comparison = state.entries
    .filter((item) => item.topicCode === entry.topicCode)
    .sort(compareEntries);

  els.comparisonList.innerHTML = comparison.length
    ? comparison.map((item) => {
      const bilingual = splitCanDo(item.canDo);
      return `
        <article class="comparison-card">
          <h4>${escapeHtml(item.level)}</h4>
          <p>${escapeHtml(bilingual.zh || item.canDo)}</p>
        </article>
      `;
    }).join("")
    : `<div class="empty-copy">当前话题暂无跨等级材料。</div>`;
}

async function renderLevelResources(level) {
  if (!level) {
    els.levelSharedWords.innerHTML = `<div class="empty-copy">请选择等级。</div>`;
    return;
  }
  const response = await fetchJson(`/api/levels/${encodeURIComponent(level)}/resources`);
  const resources = response.resources || [];
  els.levelSharedWords.innerHTML = resources.length
    ? resources.map((item) => `
      <article class="resource-item">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.content).replace(/\n/g, "<br>")}</p>
      </article>
    `).join("")
    : `<div class="empty-copy">该等级暂无功能词参考。</div>`;
}

async function runAssistantWord() {
  const word = els.assistantWordInput.value.trim();
  const level = els.assistantWordLevel.value;
  if (!word) {
    els.assistantWordOutput.innerHTML = `<div class="empty-copy">请输入一个目标词。</div>`;
    return;
  }
  await runAssistantRequest({
    button: els.assistantWordBtn,
    output: els.assistantWordOutput,
    url: "/api/assistant/word",
    body: { word, level },
    loadingText: "生成词汇材料中",
  });
}

async function runAssistantSynonyms() {
  const terms = els.assistantSynonymsInput.value.trim();
  const level = els.assistantSynonymsLevel.value;
  if (!terms) {
    els.assistantSynonymsOutput.innerHTML = `<div class="empty-copy">请输入两个或多个近义词。</div>`;
    return;
  }
  await runAssistantRequest({
    button: els.assistantSynonymsBtn,
    output: els.assistantSynonymsOutput,
    url: "/api/assistant/synonyms",
    body: { terms, level },
    loadingText: "生成近义词辨析中",
  });
}

async function runAssistantCanDo() {
  const id = els.assistantCanDoSelect.value;
  const level = els.assistantCanDoLevel.value;
  const mode = els.assistantCanDoMode.value;
  const selected = state.entries.find((entry) => entry.id === id);
  if (!selected) {
    els.assistantCanDoOutput.innerHTML = `<div class="empty-copy">请先选择一条能做描述。</div>`;
    return;
  }
  await runAssistantRequest({
    button: els.assistantCanDoBtn,
    output: els.assistantCanDoOutput,
    url: "/api/assistant/cando",
    body: { canDo: selected.canDo, level: level || selected.level, mode: mode || selected.mode, id: selected.id },
    loadingText: "生成课堂任务中",
  });
}

async function runAssistantRequest({ button, output, url, body, loadingText }) {
  button.disabled = true;
  const original = button.textContent;
  button.textContent = loadingText;
  output.innerHTML = `<div class="empty-copy">正在生成，请稍候…</div>`;
  try {
    const payload = await fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    output.innerHTML = renderAssistantResponse(payload);
  } catch (error) {
    output.innerHTML = `<div class="empty-copy">生成失败：${escapeHtml(error.message || String(error))}</div>`;
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function renderAssistantResponse(payload) {
  const matrix = payload.matrix
    ? `
      <div class="assistant-matrix-wrap">
        <table class="assistant-matrix">
          <thead>
            <tr>${(payload.matrix.headers || []).map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${(payload.matrix.rows || []).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
    `
    : "";

  const sections = (payload.sections || []).map((section) => `
    <section class="assistant-doc-section">
      <h4>${escapeHtml(section.title || "结果")}</h4>
      <div class="assistant-doc-items">
        ${(section.items || []).map((item) => `<div class="assistant-doc-item">${escapeHtml(item)}</div>`).join("")}
      </div>
    </section>
  `).join("");

  const html = `
    <article class="assistant-document">
      ${payload.documentTitle ? `<h3 class="assistant-document-title">${escapeHtml(payload.documentTitle)}</h3>` : ""}
      ${payload.overview ? `<p class="assistant-document-overview">${escapeHtml(payload.overview)}</p>` : ""}
      ${matrix}
      ${sections}
    </article>
  `;

  return sections || matrix || payload.overview ? html : `<div class="empty-copy">暂无结果。</div>`;
}

async function runVocabSearch() {
  const query = els.vocabQueryInput.value.trim();
  if (!query) {
    els.vocabSearchResults.innerHTML = `<div class="empty-copy">请输入词语。</div>`;
    return;
  }
  const data = await fetchJson(`/api/vocab/search?q=${encodeURIComponent(query)}`);
  const blocks = (data.results || []).map((item) => {
    if (!item.matches?.length) {
      return `
        <article class="lookup-card">
          <h4>${escapeHtml(item.word)}</h4>
          <div class="lookup-lines"><div class="lookup-line">未收录</div></div>
        </article>
      `;
    }
    return `
      <article class="lookup-card">
        <h4>${escapeHtml(item.word)}</h4>
        <div class="lookup-lines">
          ${item.matches.map((match) => `
            <div class="lookup-line">
              ACTFL ${escapeHtml(match.actfl || "未标注")} / 词性 ${escapeHtml(match.pos || "未标注")} / HSK ${escapeHtml(match.hsk || "-")} / PG ${escapeHtml(match.pg || "-")} / 义教 ${escapeHtml(match.basicEdu || "-")}
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
  els.vocabSearchResults.innerHTML = `<div class="lookup-group">${blocks || `<div class="empty-copy">暂无。</div>`}</div>`;
}

async function runPassageAnalysis() {
  const text = els.passageInput.value.trim();
  if (!text) {
    els.passageAnalysis.innerHTML = `<div class="empty-copy">请输入课文或材料。</div>`;
    return;
  }
  const data = await fetchJson("/api/vocab/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const counts = data.counts || [];
  const total = counts.reduce((sum, item) => sum + item.count, 0) || 1;
  const bars = counts.map((item) => `
    <div class="level-bar-row">
      <div class="level-bar-label">${escapeHtml(item.level)}</div>
      <div class="level-bar-track"><div class="level-bar-fill" style="width:${Math.max(6, Math.round(item.count / total * 100))}%"></div></div>
      <div>${item.count}</div>
    </div>
  `).join("");

  const grouped = new Map();
  for (const item of data.tokens || []) {
    const level = item.matches?.[0]?.actfl || "未收录";
    if (!grouped.has(level)) grouped.set(level, []);
    grouped.get(level).push(item.token);
  }
  const tokens = [...grouped.entries()].map(([level, words]) => {
    const uniqueWords = [...new Set(words)];
    return `
      <div class="token-group-card">
        <h4>${escapeHtml(level)}：${uniqueWords.length} 个</h4>
        <div class="token-list">${escapeHtml(uniqueWords.join("、"))}</div>
      </div>
    `;
  }).join("");

  els.passageAnalysis.innerHTML = `
    <div class="lookup-group">
      <div class="lookup-card">
        <h4>等级分布</h4>
        <div class="level-bars">${bars || `<div class="empty-copy">暂无。</div>`}</div>
      </div>
      <div class="lookup-card">
        <h4>分词结果</h4>
        <div class="lookup-line">仅供参考。分词受上下文语境影响，可能存在误差。</div>
        <div class="token-cloud">${tokens || `<div class="empty-copy">暂无。</div>`}</div>
      </div>
    </div>
  `;
}

function populateGrammarFilters() {
  if (!els.grammarLevelFilter) return;
  const levels = state.health?.grammar?.levels || [];
  fillSelect(
    els.grammarLevelFilter,
    levels.map((level) => ({ value: level, label: level })),
    "选择等级",
    "Novice Low"
  );
}

async function runGrammarLevelSearch() {
  const level = els.grammarLevelFilter?.value?.trim() || "";
  if (!level) {
    els.grammarLevelResults.innerHTML = `<div class="empty-copy">请先选择一个等级。</div>`;
    return;
  }
  const data = await fetchJson(`/api/grammar/search?level=${encodeURIComponent(level)}`);
  const items = (data.results || []).slice(0, 40);
  els.grammarLevelResults.innerHTML = items.length
    ? `<div class="lookup-group">${items.map((item) => `
      <article class="lookup-card">
        <h4>${escapeHtml(item.grammar)}</h4>
        <div class="lookup-lines">
          <div class="lookup-line">${escapeHtml(item.category)}</div>
          ${item.example ? `<div class="lookup-line">${escapeHtml(item.example)}</div>` : ""}
        </div>
      </article>
    `).join("")}</div>`
    : `<div class="empty-copy">该等级暂无结果。</div>`;
}

async function runGrammarQuerySearch() {
  const query = els.grammarQueryInput?.value?.trim() || "";
  if (!query) {
    els.grammarQueryResults.innerHTML = `<div class="empty-copy">请输入语法项关键词。</div>`;
    return;
  }
  const data = await fetchJson(`/api/grammar/search?q=${encodeURIComponent(query)}`);
  const items = (data.results || []).slice(0, 24);
  els.grammarQueryResults.innerHTML = items.length
    ? `<div class="lookup-group">${items.map((item) => `
      <article class="lookup-card">
        <h4>${escapeHtml(item.grammar)}</h4>
        <div class="lookup-lines">
          <div class="lookup-line">${escapeHtml(item.level)} / ${escapeHtml(item.category)}</div>
          ${item.example ? `<div class="lookup-line">${escapeHtml(item.example)}</div>` : ""}
        </div>
      </article>
    `).join("")}</div>`
    : `<div class="empty-copy">没有找到匹配的语法项。</div>`;
}

async function submitMessage() {
  const name = els.messageName.value.trim();
  const email = els.messageEmail.value.trim();
  const message = els.messageText.value.trim();
  if (!message) {
    els.messageStatus.textContent = "请先填写留言内容。";
    return;
  }
  els.messageSubmitBtn.disabled = true;
  els.messageStatus.textContent = "提交中...";
  try {
    await fetchJson("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message }),
    });
    els.messageName.value = "";
    els.messageEmail.value = "";
    els.messageText.value = "";
    els.messageStatus.textContent = "留言已提交，感谢反馈。";
  } catch (error) {
    els.messageStatus.textContent = `提交失败：${error.message || String(error)}`;
  } finally {
    els.messageSubmitBtn.disabled = false;
  }
}

function updateStudioNote() {
  const configured = state.health?.openaiConfigured;
  const provider = state.health?.provider?.provider || "fallback";
  els.studioNote.textContent = configured
    ? `当前已连接 ${provider} 接口。系统会先读取词汇、语法与量表信息，再生成结构化教学材料。`
    : "当前未配置模型密钥，系统会先用本地模板生成可修改版本；后续接入 DeepSeek 后，可在同一结构下提升质量。";
}

function splitCanDo(value) {
  const text = String(value || "").trim();
  if (!text) return { zh: "", en: "" };

  const firstChinese = text.search(/[\u4e00-\u9fff]/);
  if (firstChinese === -1) return { zh: text, en: "" };
  if (firstChinese === 0) return { zh: text, en: "" };

  return {
    en: text.slice(0, firstChinese).trim(),
    zh: text.slice(firstChinese).trim(),
  };
}

function applyDefaultOutlineSelection() {
  const match = state.entries.find((entry) => entry.id === state.selectedId);
  if (!match) {
    state.level = "";
    state.mode = "";
    state.themeCode = "";
    state.subthemeCode = "";
    state.topicCode = "";
    state.selectedId = "";
    return;
  }

  state.level = match.level;
  state.mode = match.mode;
  state.themeCode = match.themeCode;
  state.subthemeCode = match.subthemeCode;
  state.topicCode = match.topicCode;
}

function normalizeEntryMode(entry) {
  const bilingual = splitCanDo(entry.canDo);
  const english = (bilingual.en || "").toLowerCase();
  let mode = entry.mode || "";
  if (!["理解诠释", "人际沟通", "表达演示"].includes(mode)) {
    if (english.includes("i can understand") || english.includes("i can follow")) {
      mode = "理解诠释";
    } else if (english.includes("i can interact") || english.includes("i can discuss") || english.includes("i can negotiate")) {
      mode = "人际沟通";
    } else {
      mode = "表达演示";
    }
  }
  return { ...entry, mode };
}

function isFunctionalPseudoEntry(entry) {
  return normalizeSpace(entry.canDo).startsWith("功能词");
}

function cleanEnglishCanDo(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

function compactWordText(text) {
  return String(text || "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function pickFeaturedEntries(entries) {
  const curated = [
    {
      id: "Novice Mid|T6|T6.1|T6.1.3|88",
      image: "/docx-media/2026_ACTFL_Vocabulary_NoviceMid/image6.png",
      title: "请大家帮帮我！我的小狗不见了！",
      description: "我能根据图片或照片写一些关于动物、食物、历史人物或运动的简单细节。",
      summary: "寻狗启事",
    },
    {
      id: "Intermediate High|T3|T3.1|T3.1.8|43",
      image: "/docx-media/2026_ACTFL_Vocabulary_IntermediateHigh/image3.webp",
      title: "Mario Kart 游戏说明",
      description: "我能理解视频游戏的基本玩法说明。",
      summary: "游戏玩法说明",
    },
    {
      id: "Intermediate High|T4|T4.1|T4.1.4|65",
      image: "/docx-media/2026_ACTFL_Vocabulary_IntermediateHigh/image6.png",
      title: "《恋爱的犀牛》节选",
      description: "我能理解剧本片段中的主要内容与人物情绪。",
      summary: "戏剧文本阅读",
    },
    {
      id: "Novice High|T1|T1.3|T1.3.1|18",
      image: "/docx-media/2026_ACTFL_Vocabulary_NoviceHigh/image6.png",
      title: "@Foodie_XiaoBai",
      description: "我能理解某人在 Instagram 上对照片的简单描述。",
      summary: "社交媒体照片描述",
    },
    {
      id: "Advanced Mid|T2||T2.1.6|23",
      image: "/docx-media/2026_ACTFL_Vocabulary_AdvancedMid/image1.png",
      title: "01 岗位信息",
      description: "我能理解关于实习机会的详细描述。",
      summary: "岗位与宣传材料",
    },
  ];
  const curatedIds = new Set(curated.map((item) => item.id));
  const curatedEntries = curated
    .map((config) => {
      const entry = entries.find((item) => item.id === config.id);
      return entry
        ? {
            ...entry,
            featuredImage: config.image,
            featuredTitle: config.title,
            featuredDescription: config.description,
            featuredSummary: config.summary,
          }
        : null;
    })
    .filter(Boolean);

  const autoCandidates = entries
    .filter((entry) => !curatedIds.has(entry.id))
    .filter((entry) => !isFunctionalPseudoEntry(entry))
    .filter((entry) => entry.level !== "Advanced High+")
    .filter((entry) => Array.isArray(entry.sampleImages) && entry.sampleImages.length)
    .map((entry) => ({
      ...entry,
      featuredTitle: extractSampleTitle(entry) || splitCanDo(entry.canDo).zh || entry.topicName || entry.canDo,
      featuredDescription: splitCanDo(entry.canDo).zh || entry.canDo,
      featuredSummary: entry.topicName || entry.subthemeName || entry.themeName,
      featuredImage: entry.sampleImages[0],
    }))
    .sort(compareEntries);

  return [...curatedEntries, ...autoCandidates];
}

function extractSampleTitle(entry) {
  const text = String(entry.sample || "")
    .replace(/\[图片\]/g, "")
    .trim();
  if (!text) return "";
  const lines = text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((line) => !/^【?作品导读】?[:：]?$/.test(line));
  const line = lines.find((item) => item.length >= 4) || lines[0] || "";
  return line
    .replace(/\s*\((https?:\/\/|mailto:)[^)]+\)\s*$/i, "")
    .replace(/\s*(https?:\/\/|mailto:)\S+\s*$/i, "")
    .replace(/\s+/g, " ")
    .slice(0, 44);
}

function shortChineseTitle(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .slice(0, 28);
}

function renderTerms(target, text) {
  const tokens = String(text || "")
    .split(/[，,、；;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!tokens.length) {
    target.innerHTML = `<span class="empty-copy">暂无</span>`;
    return;
  }

  target.innerHTML = tokens.map((item) => `<span class="term-chip">${escapeHtml(item)}</span>`).join("");
}

function buildPath(entry) {
  if (!entry) return "当前无结果";
  return [entry.themeCode && `${entry.themeCode} ${entry.themeName}`, entry.subthemeCode && `${entry.subthemeCode} ${entry.subthemeName}`, entry.topicCode && `${entry.topicCode} ${entry.topicName}`]
    .filter(Boolean)
    .join(" / ");
}

function renderTextBlock(target, text) {
  target.innerHTML = escapeHtml(String(text ?? "")).replace(/\n/g, "<br>");
}

function fillSelect(select, options, placeholder, selectedValue) {
  select.innerHTML = [`<option value="">${placeholder}</option>`]
    .concat(options.map((item) => `<option value="${escapeAttr(item.value)}">${escapeHtml(item.label)}</option>`))
    .join("");
  select.value = selectedValue || "";
}

function compareEntries(a, b) {
  const order = state.health.summary.levels;
  return (
    order.indexOf(a.level) - order.indexOf(b.level) ||
    a.themeCode.localeCompare(b.themeCode) ||
    a.subthemeCode.localeCompare(b.subthemeCode) ||
    a.topicCode.localeCompare(b.topicCode) ||
    a.canDo.localeCompare(b.canDo)
  );
}

function dedupeOutlineEntries(entries) {
  const byKey = new Map();
  for (const entry of entries) {
    const key = [
      normalizeSpace(entry.level),
      normalizeSpace(entry.mode),
      normalizeSpace(entry.themeCode),
      normalizeSpace(entry.subthemeCode),
      normalizeSpace(entry.topicCode),
      normalizeSpace(entry.canDo),
    ].join("|");
    const existing = byKey.get(key);
    if (!existing || entryRichnessScore(entry) > entryRichnessScore(existing)) {
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()];
}

function entryRichnessScore(entry) {
  return [
    entry.sampleHtml ? 8 : 0,
    entry.sample ? Math.min(String(entry.sample).trim().length, 400) : 0,
    entry.sampleImages?.length ? entry.sampleImages.length * 40 : 0,
    entry.coreWords ? String(entry.coreWords).length : 0,
    entry.relatedWords ? String(entry.relatedWords).length : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item[key] || seen.has(item[key])) return false;
    seen.add(item[key]);
    return true;
  });
}

function linkifyHtml(htmlText) {
  const template = document.createElement("template");
  template.innerHTML = String(htmlText || "");
  for (const anchor of template.content.querySelectorAll("a[href]")) {
    const cleaned = sanitizeLinkTarget(anchor.getAttribute("href"));
    if (cleaned) {
      anchor.setAttribute("href", cleaned);
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    }
  }
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  for (const node of textNodes) {
    if (node.parentElement?.closest("a")) continue;
    const text = node.textContent || "";
    if (!/(https?:\/\/|mailto:)/i.test(text)) continue;

    const normalizedText = text.replace(/%20(?=https?:\/\/|mailto:)/gi, " ");
    const titledLink = normalizedText.match(/^\s*(.+?)\s*[（(]\s*((?:https?:\/\/|mailto:)[^)\]）】\s]+)\s*[)）]\s*$/i);
    const messyTitledLink = normalizedText.match(/^\s*(.+?)\s*[（(][\s\S]*?((?:https?:\/\/|mailto:)[^)\]）】\s]+)[\s\S]*?[)）]\s*$/i);
    const linkMatch = titledLink || messyTitledLink;
    if (linkMatch) {
      const fragment = document.createDocumentFragment();
      const anchor = document.createElement("a");
      anchor.href = sanitizeLinkTarget(linkMatch[2]);
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = linkMatch[1].replace(/[（(]\s*$/g, "").trim();
      fragment.appendChild(anchor);
      node.replaceWith(fragment);
      continue;
    }

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    const regex = /(https?:\/\/[^\s<)"'，。；！？】》]+|mailto:[^\s<)"'，。；！？】》]+)/gi;
    let match;
    while ((match = regex.exec(normalizedText))) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(normalizedText.slice(lastIndex, match.index)));
      }
      const anchor = document.createElement("a");
      anchor.href = sanitizeLinkTarget(match[0]);
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = sanitizeLinkTarget(match[0]);
      fragment.appendChild(anchor);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < normalizedText.length) {
      fragment.appendChild(document.createTextNode(normalizedText.slice(lastIndex)));
    }
    node.replaceWith(fragment);
  }

  return template.innerHTML;
}

function sanitizeLinkTarget(target) {
  const raw = String(target || "")
    .replace(/^(?:%20|\s)+/gi, "")
    .replace(/^https:\/(?!\/)/i, "https://")
    .replace(/^http:\/(?!\/)/i, "http://")
    .replace(/[)）]+$/g, "")
    .replace(/]$/g, "")
    .replace(/。+$/g, "")
    .replace(/，+$/g, "")
    .replace(/；+$/g, "")
    .replace(/！+$/g, "")
    .replace(/？+$/g, "")
    .replace(/[)\]）】]+$/g, "")
    .trim();
  const matchedUrl = raw.match(/(?:https?:\/\/|https:\/|http:\/\/|http:\/)[^\s<)"'，。；！？】》]+/i);
  if (!matchedUrl) return raw;
  return matchedUrl[0]
    .replace(/^https:\/(?!\/)/i, "https://")
    .replace(/^http:\/(?!\/)/i, "http://")
    .trim();
}

function normalizeSpace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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
