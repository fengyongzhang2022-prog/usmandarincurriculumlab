"""
ACTFL语法量表研制分析
三专家辩论后的高效实现方案：
  A（计算语言学家）：主张字符N-gram模糊匹配
  B（语法理论家）：  主张基于别名映射的精确匹配
  C（工程师）：      主张可审计的分层匹配+置信度评分

→ 最终采用C方案骨架 + B方案别名映射 + A方案两字符前缀回退
  输出：精确对应矩阵（1:1/1:N/N:1/1:0/0:1）+ 完整统计
"""
import pandas as pd, re, sys, collections
from itertools import groupby

sys.stdout.reconfigure(encoding="utf-8")
BASE = r"D:\2026 ACTFL 词表\词表202603\结项报告"
actfl = pd.read_excel(BASE + r"\ACTFL语法量表总表.xlsx")
pg    = pd.read_excel(BASE + r"\等级标准语法大纲.xlsx")
hsk   = pd.read_csv(BASE + r"\HSK_Grammar_MCP_Resource_Cleaned.csv", encoding="utf-8-sig")
for df in (actfl, pg, hsk):
    df.columns = df.columns.str.strip()

# ── 别名映射 (Expert B) ────────────────────────────────────────────────────────
ALIASES = {
    "被字句":       ["被动句"],
    "趋向动词":     ["趋向补语"],
    "方位名词短语":  ["方位名词", "方位短语"],
    "形容词谓语句":  ["形容词谓语", "形容词性谓语"],
    "名词谓语句":   ["名词性谓语", "名词谓语"],
    "动词谓语句":   ["动词谓语"],
    "主谓谓语句":   ["主谓谓语"],
    "语气助词":     ["语气词"],
    "离合动词":     ["离合词"],
    "兼语句":       ["兼语"],
    "连动句":       ["连动"],
    "存现句":       ["存现"],
    "双宾语":       ["双宾"],
    "感叹句":       ["感叹"],
    "特指问":       ["特指疑问句", "疑问代词"],
    "是非问":       ["是非疑问句"],
    "正反问":       ["正反疑问句"],
    "选择问":       ["选择疑问句"],
}

LEVEL_ORDER = {"一级":1,"二级":2,"三级":3,"四级":4,"五级":5,"六级":6,
               "七级":7,"七一九级":8,"七—九级":8,"七－九级":8}
ACTFL_ORDER = {"Novice Low":1,"Novice Mid":2,"Novice High":3,
               "Intermediate  Low":4,"Intermediate Low":4,
               "Intermediate Mid":5,"Intermediate High":6,"Advanced+":7}

def lv(s): return LEVEL_ORDER.get(str(s).strip(), 99)
def alv(s): return ACTFL_ORDER.get(str(s).strip(), 99)

# ── 关键词提取 (Expert B 精确策略) ─────────────────────────────────────────────
def extract_key(text):
    t = str(text).strip()
    t = re.sub(r"^\d*\s*【[^】]+】\s*", "", t)
    t = t.split("：")[0].split(":")[0].strip()
    t = re.sub(r"[（(][^）)]+[)）]", "", t).strip()
    for q in ('"','"','"','"','"',"'"):
        t = t.replace(q, "")
    t = re.sub(r"\.{2,}", "", t).strip("—–-·· ")
    t = re.sub(r"\d+\s*$", "", t).strip()
    return t

# ── 多行匹配（返回所有匹配行，Expert C 可审计） ─────────────────────────────────
def match_all_rows(search_terms, df, exact_cols, fuzzy_cols):
    """返回 {matched_indices: set, earliest_level: str}"""
    all_idx = set()
    all_lvs = []
    for key in search_terms:
        if not key or len(key) < 2:
            continue
        esc = re.escape(key)
        found = False
        for col in exact_cols:
            if col not in df.columns: continue
            m = df[col].fillna("").str.strip() == key
            if m.any():
                all_idx.update(df[m].index.tolist())
                all_lvs += [lv(r) for r in df.loc[df[m].index, "等级"]]
                found = True
        if not found:
            for col in exact_cols:
                if col not in df.columns: continue
                m = df[col].fillna("").str.contains(esc, regex=True)
                if m.any():
                    all_idx.update(df[m].index.tolist())
                    all_lvs += [lv(r) for r in df.loc[df[m].index, "等级"]]
                    found = True
                    break
        if not found:
            for col in fuzzy_cols:
                if col not in df.columns: continue
                m = df[col].fillna("").str.contains(esc, regex=True)
                if m.any():
                    all_idx.update(df[m].index.tolist())
                    all_lvs += [lv(r) for r in df.loc[df[m].index, "等级"]]
                    break
        # Expert A 回退：2字前缀
        if not all_idx and len(key) >= 3:
            prefix = key[:2]
            for col in exact_cols:
                if col not in df.columns: continue
                m = df[col].fillna("").str.startswith(prefix)
                if m.any():
                    all_idx.update(df[m].index.tolist())
                    all_lvs += [lv(r) for r in df.loc[df[m].index, "等级"]]
                    break

    best_lv = None
    if all_lvs:
        lv_num = min(all_lvs)
        rev = {v:k for k,v in LEVEL_ORDER.items() if k not in ("七－九级","七—九级")}
        best_lv = rev.get(lv_num, "")
    return {"indices": all_idx, "level": best_lv, "n_rows": len(all_idx)}

def get_terms(key):
    return [key] + ALIASES.get(key, [])

# ── Pass 1: 建立 ACTFL → HSK/PG 全量对应 ──────────────────────────────────────
records = []
pg_covered  = set()
hsk_covered = set()

for _, ar in actfl.iterrows():
    key        = extract_key(str(ar.get("语法项","")))
    terms      = get_terms(key)
    actfl_lv   = str(ar.get("等级","")).strip()
    gram_class = str(ar.get("语法类","")).strip()

    pg_res  = match_all_rows(terms, pg,  ["细目","类别名称"], ["语法内容"])
    hsk_res = match_all_rows(terms, hsk, ["细目","类别名称"], ["语法内容"])
    pg_covered.update(pg_res["indices"])
    hsk_covered.update(hsk_res["indices"])

    records.append({
        "key":          key,
        "actfl_level":  actfl_lv,
        "actfl_class":  gram_class,
        "actfl_item":   str(ar.get("语法项","")),
        "hsk_level":    hsk_res["level"] or "",
        "pg_level":     pg_res["level"]  or "",
        "hsk_n":        hsk_res["n_rows"],
        "pg_n":         pg_res["n_rows"],
        "hsk_idx":      frozenset(hsk_res["indices"]),
        "pg_idx":       frozenset(pg_res["indices"]),
    })

# ── 判断对应类型 ────────────────────────────────────────────────────────────────
# 同一个 HSK/PG index 被多个 ACTFL 条目引用 → N:1
from collections import Counter
hsk_idx_to_actfl = collections.defaultdict(list)
pg_idx_to_actfl  = collections.defaultdict(list)
for i, rec in enumerate(records):
    for idx in rec["hsk_idx"]:
        hsk_idx_to_actfl[idx].append(i)
    for idx in rec["pg_idx"]:
        pg_idx_to_actfl[idx].append(i)

def corr_type(rec):
    has_hsk = rec["hsk_n"] > 0
    has_pg  = rec["pg_n"]  > 0
    if not has_hsk and not has_pg:
        return "ACTFL独有"
    parts = []
    if has_hsk:
        n_a2h = rec["hsk_n"]
        is_n1 = any(len(hsk_idx_to_actfl[i]) > 1 for i in rec["hsk_idx"])
        if is_n1:
            parts.append(f"HSK(N:1,共享{n_a2h}行)")
        elif n_a2h > 1:
            parts.append(f"HSK(1:{n_a2h})")
        else:
            parts.append("HSK(1:1)")
    if has_pg:
        n_a2p = rec["pg_n"]
        is_n1 = any(len(pg_idx_to_actfl[i]) > 1 for i in rec["pg_idx"])
        if is_n1:
            parts.append(f"PG(N:1,共享{n_a2p}行)")
        elif n_a2p > 1:
            parts.append(f"PG(1:{n_a2p})")
        else:
            parts.append("PG(1:1)")
    return " | ".join(parts)

for rec in records:
    rec["corr_type"] = corr_type(rec)

# ── Pass 2: 未被覆盖的 HSK/PG 条目 ─────────────────────────────────────────────
unmatched_pg  = pg[~pg.index.isin(pg_covered)].copy()
unmatched_hsk = hsk[~hsk.index.isin(hsk_covered)].copy()

# 交叉匹配 PG独有 vs HSK独有
hsk2_covered = set()
appendix = []
for idx, pr in unmatched_pg.iterrows():
    key = str(pr.get("细目","") or "").strip()
    if not key or key=="nan": key = str(pr.get("类别名称","") or "").strip()
    if key=="nan": key=""
    terms = get_terms(key)
    res2 = match_all_rows(terms, unmatched_hsk, ["细目","类别名称"], ["语法内容"])
    hsk2_covered.update(res2["indices"])
    content = str(pr.get("细目","") or pr.get("语法内容","") or "").strip()
    if content=="nan": content=""
    ex = str(pr.get("例句","") or "").strip()
    if ex=="nan": ex=""
    src = "HSK+PG共有" if res2["level"] else "PG独有"
    appendix.append({
        "语法项": key or content[:30],
        "语法类": f"{pr.get('类别','')}{pr.get('类别名称','')}",
        "ACTFL等级": "", "HSK等级": res2["level"] or "",
        "PG等级": str(pr.get("等级","")), "来源": src,
        "语法描述": content, "例句": ex,
        "_lv": lv(pr.get("等级",""))
    })

for idx, hr in unmatched_hsk[~unmatched_hsk.index.isin(hsk2_covered)].iterrows():
    key = str(hr.get("细目","") or "").strip()
    if not key or key=="nan": key = str(hr.get("类别名称","") or "").strip()
    if key=="nan": key=""
    content = str(hr.get("语法内容","") or "").strip()
    if content=="nan": content=""
    appendix.append({
        "语法项": key or content[:30],
        "语法类": f"{hr.get('类别','')}{hr.get('类别名称','')}",
        "ACTFL等级": "", "HSK等级": str(hr.get("等级","")),
        "PG等级": "", "来源": "HSK独有",
        "语法描述": content, "例句": "",
        "_lv": lv(hr.get("等级",""))
    })

appendix.sort(key=lambda r: ({"HSK+PG共有":0,"PG独有":1,"HSK独有":2}.get(r["来源"],9), r["_lv"]))
for r in appendix: r.pop("_lv", None)

# ═══════════════════════════════════════════════════════════════════════════════
# 统计报告（供研制报告使用）
# ═══════════════════════════════════════════════════════════════════════════════
print("=" * 65)
print("         ACTFL 语法量表研制分析报告 — 数据统计")
print("=" * 65)

print(f"\n【总量】")
print(f"  ACTFL 语法量表：{len(actfl)} 条")
print(f"  HSK  语法量表：{len(hsk)} 条")
print(f"  PG（等级标准）：{len(pg)} 条")

print(f"\n【ACTFL 等级分布】")
for lv_name in ["Novice Low","Novice Mid","Novice High",
                 "Intermediate  Low","Intermediate Mid","Intermediate High","Advanced+"]:
    n = sum(1 for r in records if r["actfl_level"].strip() == lv_name.strip())
    if n: print(f"  {lv_name:25} {n:3} 条")

print(f"\n【对应类型统计（以ACTFL为主体）】")
type_counts = collections.Counter()
for r in records:
    ct = r["corr_type"]
    # 简化分类
    if ct == "ACTFL独有":
        type_counts["ACTFL独有（0匹配）"] += 1
    elif "N:1" in ct:
        type_counts["N:1（多ACTFL→单HSK/PG）"] += 1
    elif any(f"1:{n}" in ct for n in ["2","3","4","5","6","7","8","9"]):
        type_counts["1:N（单ACTFL→多HSK/PG行）"] += 1
    else:
        type_counts["1:1（精确对应）"] += 1
for k,v in type_counts.most_common():
    pct = v/len(records)*100
    print(f"  {k:30} {v:3} 条 ({pct:.1f}%)")

print(f"\n【1:N 示例（ACTFL合并，HSK/PG细分）】")
one_to_n = [(r["key"], r["actfl_level"], r["hsk_n"], r["pg_n"])
            for r in records
            if (r["hsk_n"] > 1 or r["pg_n"] > 1) and "N:1" not in r["corr_type"]]
for key, lv_, hn, pn in one_to_n[:10]:
    print(f"  {key:18} ACTFL:{lv_[:14]:14} → HSK:{hn}行 PG:{pn}行")

print(f"\n【N:1 示例（ACTFL细分，HSK/PG合并）】")
# 找 HSK index 被多个 ACTFL 引用
shared_hsk = {idx: acts for idx, acts in hsk_idx_to_actfl.items() if len(acts) > 1}
print(f"  共 {len(shared_hsk)} 个 HSK 行被多个 ACTFL 条目共享")
shown = set()
for idx, act_ids in list(shared_hsk.items())[:5]:
    hsk_term = str(hsk.loc[idx,"细目"] or hsk.loc[idx,"类别名称"] or "")
    actfl_keys = [records[i]["key"] for i in act_ids]
    key_str = "、".join(actfl_keys[:3])
    if key_str not in shown:
        print(f"  HSK[{idx}]{hsk_term:12} ← ACTFL: {key_str}")
        shown.add(key_str)

print(f"\n【附录（非ACTFL项）统计】")
app_src = collections.Counter(r["来源"] for r in appendix)
for k,v in app_src.most_common():
    print(f"  {k:15} {v:3} 条")

print(f"\n【HSK/PG 覆盖率】")
print(f"  HSK 已被ACTFL覆盖：{len(hsk_covered)}/{len(hsk)} ({len(hsk_covered)/len(hsk)*100:.1f}%)")
print(f"  PG  已被ACTFL覆盖：{len(pg_covered)}/{len(pg)} ({len(pg_covered)/len(pg)*100:.1f}%)")

# 按 ACTFL 等级的 HSK/PG 对应率
print(f"\n【各ACTFL等级的对应率】")
for lv_name in ["Novice Low","Novice Mid","Novice High",
                 "Intermediate  Low","Intermediate Mid","Intermediate High","Advanced+"]:
    grp = [r for r in records if r["actfl_level"].strip() == lv_name.strip()]
    if not grp: continue
    matched = sum(1 for r in grp if r["hsk_level"] or r["pg_level"])
    both    = sum(1 for r in grp if r["hsk_level"] and r["pg_level"])
    print(f"  {lv_name:25} n={len(grp):3}  匹配任一={matched:3}({matched/len(grp)*100:.0f}%)  "
          f"三系共有={both:3}({both/len(grp)*100:.0f}%)")

# 类别对比
print(f"\n【语法类别分布对比】")
actfl_cats = collections.Counter()
for r in records:
    cat = r["actfl_class"]
    # 简化
    if "词类" in cat: actfl_cats["词类"] += 1
    elif "短语" in cat or "句法成分" in cat: actfl_cats["短语/句法成分"] += 1
    elif "句子" in cat or "句式" in cat or "句型" in cat: actfl_cats["句子/句式"] += 1
    elif "格式" in cat or "口语" in cat: actfl_cats["格式/口语"] += 1
    elif "篇章" in cat or "语段" in cat or "语体" in cat: actfl_cats["语体/篇章"] += 1
    elif "表达" in cat: actfl_cats["表达意念"] += 1
    else: actfl_cats["其他"] += 1
print("  ACTFL:", dict(actfl_cats))
pg_cats = dict(pg["类别"].value_counts())
hsk_cats= dict(hsk["类别"].value_counts())
print("  PG:   ", {k:v for k,v in pg_cats.items()})
print("  HSK:  ", {k:v for k,v in hsk_cats.items()})

# 完整数据输出（供报告引用）
import json
stats = {
    "total": {"actfl": len(actfl), "hsk": len(hsk), "pg": len(pg)},
    "corr_types": dict(type_counts),
    "appendix": dict(app_src),
    "hsk_coverage": round(len(hsk_covered)/len(hsk)*100,1),
    "pg_coverage":  round(len(pg_covered)/len(pg)*100,1),
    "matched_any":  sum(1 for r in records if r["hsk_level"] or r["pg_level"]),
    "matched_both": sum(1 for r in records if r["hsk_level"] and r["pg_level"]),
    "one_to_n_examples": [(r["key"], r["actfl_level"].strip(), r["hsk_n"], r["pg_n"])
                           for r in records if r["hsk_n"]>1 or r["pg_n"]>1][:15],
    "level_stats": {}
}
for lv_name in ["Novice Low","Novice Mid","Novice High",
                 "Intermediate  Low","Intermediate Mid","Intermediate High","Advanced+"]:
    grp = [r for r in records if r["actfl_level"].strip() == lv_name.strip()]
    if not grp: continue
    stats["level_stats"][lv_name] = {
        "n": len(grp),
        "matched_any":  sum(1 for r in grp if r["hsk_level"] or r["pg_level"]),
        "matched_both": sum(1 for r in grp if r["hsk_level"] and r["pg_level"]),
        "actfl_only":   sum(1 for r in grp if not r["hsk_level"] and not r["pg_level"]),
    }

with open(BASE+r"\_analysis_stats.json","w",encoding="utf-8") as f:
    json.dump(stats,f,ensure_ascii=False,indent=2)
print("\n✓ 统计数据已写入 _analysis_stats.json")
print("=" * 65)
