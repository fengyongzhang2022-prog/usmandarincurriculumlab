import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "2026美国中文教学词汇与语法等级量表"
OUTPUT_DIR = ROOT / "site"
OUTPUT_FILE = OUTPUT_DIR / "data.js"
OUTPUT_JSON_FILE = OUTPUT_DIR / "data.json"

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

LEVEL_LABELS = {
    "NoviceLow": "Novice Low",
    "NoviceMid": "Novice Mid",
    "NoviceHigh": "Novice High",
    "IntermediateLow": "Intermediate Low",
    "IntermediateMid": "Intermediate Mid",
    "IntermediateHigh": "Intermediate High",
    "AdvancedLow": "Advanced Low",
    "AdvancedMid": "Advanced Mid",
    "AdvancedHigh+": "Advanced High+",
}


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()


def split_code_and_name(text: str):
    cleaned = normalize_space(text)
    match = re.match(r"^(T\s*\d+(?:\.\d+)*)\s*(.*)$", cleaned)
    if not match:
        return {"code": "", "name": cleaned}
    return {"code": match.group(1).replace(" ", ""), "name": normalize_space(match.group(2))}


def infer_level(docx_name: str) -> str:
    raw = docx_name.replace("2026_ACTFL_Vocabulary_", "").replace(".docx", "")
    return LEVEL_LABELS.get(raw, raw)


def read_docx_table_rows(path: Path):
    with zipfile.ZipFile(path) as archive:
        xml = ET.fromstring(archive.read("word/document.xml"))

    tables = xml.findall(".//w:tbl", NS)
    if not tables:
        return []

    candidate_rows = []
    for table in tables:
        rows = []
        for tr in table.findall("w:tr", NS):
            row = []
            for tc in tr.findall("w:tc", NS):
                text = "".join(t.text or "" for t in tc.iterfind(".//w:t", NS))
                row.append(normalize_space(text))
            rows.append(row)

        flat_text = " ".join(" ".join(row) for row in rows)
        if "主题 T" in flat_text or "子主题 T" in flat_text or "能做示例" in flat_text or "“能做”示例" in flat_text:
            candidate_rows.extend(rows)

    return candidate_rows


def parse_material_rows(rows, level):
    entries = []
    current_theme = {"code": "", "name": ""}
    current_subtheme = {"code": "", "name": ""}
    previous = {"can_do": "", "mode": "", "topic": "", "core_words": "", "related_words": "", "sample": ""}
    collecting = False

    for row in rows:
        row = row + [""] * (6 - len(row))
        cells = [normalize_space(value) for value in row[:6]]
        first = cells[0]

        if first.startswith("主题"):
            current_theme = split_code_and_name(first.replace("主题", "", 1))
            current_subtheme = {"code": "", "name": ""}
            continue

        if first.startswith("子主题"):
            current_subtheme = split_code_and_name(first.replace("子主题", "", 1))
            continue

        if "能做示例" in first or "“能做”示例" in first:
            collecting = True
            previous = {"can_do": "", "mode": "", "topic": "", "core_words": "", "related_words": "", "sample": ""}
            continue

        if not collecting:
            continue

        if not any(cells):
            continue

        record = {
            "level": level,
            "themeCode": current_theme["code"],
            "themeName": current_theme["name"],
            "subthemeCode": current_subtheme["code"],
            "subthemeName": current_subtheme["name"],
            "canDo": cells[0] or previous["can_do"],
            "mode": cells[1] or previous["mode"],
            "topicRaw": cells[2] or previous["topic"],
            "coreWords": cells[3] or previous["core_words"],
            "relatedWords": cells[4] or previous["related_words"],
            "sample": cells[5] or previous["sample"],
        }

        topic = split_code_and_name(record["topicRaw"])
        record["topicCode"] = topic["code"]
        record["topicName"] = topic["name"]
        record["id"] = f"{level}|{record['themeCode']}|{record['subthemeCode']}|{record['topicCode']}|{len(entries)+1}"

        entries.append(record)
        previous = {
            "can_do": record["canDo"],
            "mode": record["mode"],
            "topic": record["topicRaw"],
            "core_words": record["coreWords"],
            "related_words": record["relatedWords"],
            "sample": record["sample"],
        }

    return entries


def build_dataset():
    files = sorted(
        path
        for path in SOURCE_DIR.glob("2026_ACTFL_Vocabulary_*.docx")
        if not path.name.startswith("~$")
    )

    entries = []
    for path in files:
        level = infer_level(path.name)
        rows = read_docx_table_rows(path)
        entries.extend(parse_material_rows(rows, level))

    themes = sorted({(item["themeCode"], item["themeName"]) for item in entries})
    subthemes = sorted({(item["subthemeCode"], item["subthemeName"], item["themeCode"]) for item in entries})
    topics = sorted({(item["topicCode"], item["topicName"], item["subthemeCode"]) for item in entries if item["topicCode"] or item["topicName"]})
    levels = sorted({item["level"] for item in entries}, key=lambda value: list(LEVEL_LABELS.values()).index(value))

    return {
        "summary": {
            "entryCount": len(entries),
            "themeCount": len(themes),
            "subthemeCount": len(subthemes),
            "topicCount": len(topics),
            "levels": levels,
        },
        "entries": entries,
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = build_dataset()
    OUTPUT_JSON_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    OUTPUT_FILE.write_text(
        "window.ACTFL_VOCAB_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {payload['summary']['entryCount']} entries to {OUTPUT_FILE} and {OUTPUT_JSON_FILE}")


if __name__ == "__main__":
    main()
