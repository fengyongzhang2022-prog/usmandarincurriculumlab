import json
import re
import zipfile
from html import escape
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "2026美国中文教学词汇与语法等级量表"
OUTPUT_DIR = ROOT / "site"
OUTPUT_FILE = OUTPUT_DIR / "data.js"
OUTPUT_JSON_FILE = OUTPUT_DIR / "data.json"
MEDIA_DIR = OUTPUT_DIR / "docx-media"

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "p": "http://schemas.openxmlformats.org/package/2006/relationships",
}

SYMBOL_MAP = {
    ("Wingdings", "004A"): "☺",
    ("Wingdings", "004C"): "☹",
}

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

LEVEL_TO_DOC_STEM = {
    "Novice Low": "2026_ACTFL_Vocabulary_NoviceLow",
    "Novice Mid": "2026_ACTFL_Vocabulary_NoviceMid",
    "Novice High": "2026_ACTFL_Vocabulary_NoviceHigh",
    "Intermediate Low": "2026_ACTFL_Vocabulary_IntermediateLow",
    "Intermediate Mid": "2026_ACTFL_Vocabulary_IntermediateMid",
    "Intermediate High": "2026_ACTFL_Vocabulary_IntermediateHigh",
    "Advanced Low": "2026_ACTFL_Vocabulary_AdvancedLow",
    "Advanced Mid": "2026_ACTFL_Vocabulary_AdvancedMid",
    "Advanced High+": "2026_ACTFL_Vocabulary_AdvancedHigh",
}


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()


def normalize_multiline(text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", (text or "").replace("\r\n", "\n").replace("\r", "\n")).strip()


def sanitize_name(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", text).strip("-") or "doc"


def empty_cell():
    return {"text": "", "html": "", "images": []}


def split_code_and_name(text: str):
    cleaned = normalize_space(text)
    match = re.match(r"^(T\s*\d+(?:\.\d+)*)\s*(.*)$", cleaned)
    if not match:
        return {"code": "", "name": cleaned}
    return {"code": match.group(1).replace(" ", ""), "name": normalize_space(match.group(2))}


def normalize_mode(text: str) -> str:
    cleaned = normalize_multiline(text)
    compact = normalize_space(cleaned)
    compact = compact.replace("【Presentational Communication,表达演示】", "表达演示")
    compact = compact.replace("【Interpretive Communication,理解诠释】", "理解诠释")
    compact = compact.replace("【Interpersonal Communication,人际沟通】", "人际沟通")
    compact = compact.replace("理解 诠释", "理解诠释")
    compact = compact.replace("人际 沟通", "人际沟通")
    compact = compact.replace("表达 演示", "表达演示")
    return compact


def infer_mode_from_can_do(can_do: str) -> str:
    text = normalize_space(can_do).lower()
    if "i can understand" in text or "i can follow" in text:
        return "理解诠释"
    if "i can interact" in text:
        return "人际沟通"
    if "i can present" in text or "i can give a presentation" in text:
        return "表达演示"
    return ""


def is_level_resource(can_do: str, mode_text: str) -> bool:
    can_do_clean = normalize_space(can_do)
    mode_clean = normalize_multiline(mode_text)
    return (bool(re.match(r"^0\.\d+", can_do_clean)) or can_do_clean.startswith("功能词")) and (
        "副词" in mode_clean
        or "连词" in mode_clean
        or "介词" in mode_clean
        or "助词" in mode_clean
        or "语块" in mode_clean
        or "叹词" in mode_clean
        or "拟声词" in mode_clean
    )


def infer_level(docx_name: str) -> str:
    raw = docx_name.replace("2026_ACTFL_Vocabulary_", "").replace(".docx", "")
    return LEVEL_LABELS.get(raw, raw)


def read_docx_table_rows(path: Path):
    with zipfile.ZipFile(path) as archive:
        xml = ET.fromstring(archive.read("word/document.xml"))
        rels = ET.fromstring(archive.read("word/_rels/document.xml.rels"))
        rid_to_target = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall("p:Relationship", NS)}
        export_media_assets(archive, path.stem)

    tables = xml.findall(".//w:tbl", NS)
    if not tables:
        return []

    candidate_rows = []
    for table in tables:
        rows = []
        for tr in table.findall("w:tr", NS):
            row = []
            for tc in tr.findall("w:tc", NS):
                row.append(parse_cell(tc, rid_to_target, path.stem))
            rows.append(row)

        flat_text = " ".join(" ".join(cell["text"] for cell in row) for row in rows)
        if "主题 T" in flat_text or "子主题 T" in flat_text or "能做示例" in flat_text or "“能做”示例" in flat_text:
            candidate_rows.extend(rows)

    return candidate_rows


def export_media_assets(archive: zipfile.ZipFile, doc_stem: str):
    doc_dir = MEDIA_DIR / sanitize_name(doc_stem)
    doc_dir.mkdir(parents=True, exist_ok=True)

    for name in archive.namelist():
        if not name.startswith("word/media/") or name.endswith("/"):
            continue
        filename = Path(name).name
        target = doc_dir / filename
        if not target.exists():
            target.write_bytes(archive.read(name))


def parse_cell(tc, rid_to_target, doc_stem: str):
    blocks = []
    plain_parts = []
    images = []

    for child in list(tc):
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            paragraph_html, paragraph_text, paragraph_images = parse_paragraph_element(child, rid_to_target, doc_stem)
            if paragraph_html:
                blocks.append(f"<p>{paragraph_html}</p>")
            if paragraph_text:
                plain_parts.append(paragraph_text)
            images.extend(paragraph_images)
            continue

        if tag == "tbl":
            table_html, table_text, table_images = parse_table_element(child, rid_to_target, doc_stem)
            if table_html:
                blocks.append(table_html)
            if table_text:
                plain_parts.append(table_text)
            images.extend(table_images)

    return {
        "text": "\n\n".join(part for part in plain_parts if part).strip(),
        "html": "".join(blocks).strip(),
        "images": images,
    }


def parse_paragraph_element(p, rid_to_target, doc_stem: str):
    paragraph_segments = []
    paragraph_plain = []
    images = []
    field_state = None

    for child in list(p):
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "r":
            fld_type = get_field_char_type(child)
            instr_text = get_instruction_text(child)

            if fld_type == "begin":
                field_state = {
                    "instr": "",
                    "html_parts": [],
                    "plain_parts": [],
                    "images": [],
                    "result_started": False,
                }
                continue

            if field_state is not None:
                if instr_text:
                    field_state["instr"] += instr_text
                if fld_type == "separate":
                    field_state["result_started"] = True
                    continue
                if fld_type == "end":
                    html_text, plain_text, field_images = build_field_link(
                        field_state["instr"],
                        field_state["html_parts"],
                        field_state["plain_parts"],
                        field_state["images"],
                    )
                    if html_text:
                        paragraph_segments.append(html_text)
                    if plain_text:
                        paragraph_plain.append(plain_text)
                    images.extend(field_images)
                    field_state = None
                    continue
                if field_state["result_started"]:
                    append_run_content(
                        child,
                        field_state["html_parts"],
                        field_state["plain_parts"],
                        field_state["images"],
                        rid_to_target,
                        doc_stem,
                    )
                continue

            append_run_content(child, paragraph_segments, paragraph_plain, images, rid_to_target, doc_stem)
            continue

        if tag == "hyperlink":
            link_text_parts = []
            link_plain_parts = []
            embedded_media = []
            for run in child.findall("w:r", NS):
                append_run_content(run, link_text_parts, link_plain_parts, embedded_media, rid_to_target, doc_stem)

            rid = child.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            target = rid_to_target.get(rid or "", "")
            link_text_html = "".join(link_text_parts).strip()
            link_text_plain = "".join(link_plain_parts).strip()

            if target and link_text_html:
                paragraph_segments.append(
                    f'<a href="{escape(target)}" target="_blank" rel="noopener noreferrer">{link_text_html}</a>'
                )
            else:
                paragraph_segments.extend(link_text_parts)

            if link_text_plain:
                if target:
                    paragraph_plain.append(f"{link_text_plain} ({target})")
                else:
                    paragraph_plain.append(link_text_plain)

            images.extend(embedded_media)
            continue

        if tag == "fldSimple":
            field_html, field_plain, field_images = parse_field_simple(child, rid_to_target, doc_stem)
            if field_html:
                paragraph_segments.append(field_html)
            if field_plain:
                paragraph_plain.append(field_plain)
            images.extend(field_images)

    if field_state is not None:
        html_text, plain_text, field_images = build_field_link(
            field_state["instr"],
            field_state["html_parts"],
            field_state["plain_parts"],
            field_state["images"],
        )
        if html_text:
            paragraph_segments.append(html_text)
        if plain_text:
            paragraph_plain.append(plain_text)
        images.extend(field_images)

    return "".join(paragraph_segments).strip(), "".join(paragraph_plain).strip(), images


def parse_table_element(tbl, rid_to_target, doc_stem: str):
    row_html = []
    row_texts = []
    images = []

    for tr in tbl.findall("w:tr", NS):
        cell_html = []
        cell_text = []
        for tc in tr.findall("w:tc", NS):
            parsed = parse_cell(tc, rid_to_target, doc_stem)
            cell_html.append(f'<td>{parsed["html"] or ""}</td>')
            cell_text.append(parsed["text"])
            images.extend(parsed["images"])
        row_html.append(f"<tr>{''.join(cell_html)}</tr>")
        row_texts.append(" | ".join(part for part in cell_text if part))

    html = f'<table class="embedded-table">{"".join(row_html)}</table>' if row_html else ""
    text = "\n".join(part for part in row_texts if part)
    return html, text, images


def append_run_content(run, html_parts, plain_parts, images, rid_to_target, doc_stem: str):
    for br in run.findall("w:br", NS):
        html_parts.append("<br>")
        plain_parts.append("\n")

    for sym in run.findall("w:sym", NS):
        font = sym.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}font", "")
        char = sym.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}char", "")
        symbol_text = decode_symbol(font, char)
        if symbol_text:
            html_parts.append(escape(symbol_text))
            plain_parts.append(symbol_text)

    text = "".join(t.text or "" for t in run.findall(".//w:t", NS))
    if text:
        html_parts.append(escape(text))
        plain_parts.append(text)

    for blip in run.findall(".//a:blip", NS):
        rid = blip.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
        target = rid_to_target.get(rid or "", "")
        if target:
            image_name = Path(target).name
            image_url = f"/docx-media/{sanitize_name(doc_stem)}/{image_name}"
            images.append(image_url)
            html_parts.append(f'<img src="{image_url}" alt="{escape(image_name)}" class="embedded-media">')
            plain_parts.append("[图片]")


def decode_symbol(font: str, char_code: str) -> str:
    key = (font or "", (char_code or "").upper())
    if key in SYMBOL_MAP:
        return SYMBOL_MAP[key]
    if not char_code:
        return ""
    try:
        return chr(int(char_code, 16))
    except ValueError:
        return ""


def get_field_char_type(run) -> str:
    fld_char = run.find("w:fldChar", NS)
    if fld_char is None:
        return ""
    return (
        fld_char.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fldCharType")
        or fld_char.attrib.get("fldCharType")
        or ""
    )


def get_instruction_text(run) -> str:
    return "".join(node.text or "" for node in run.findall("w:instrText", NS))


def parse_field_simple(node, rid_to_target, doc_stem: str):
    instr = (
        node.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}instr")
        or node.attrib.get("instr")
        or ""
    )
    html_parts = []
    plain_parts = []
    images = []
    for run in node.findall("w:r", NS):
        append_run_content(run, html_parts, plain_parts, images, rid_to_target, doc_stem)

    html_text = "".join(html_parts).strip()
    plain_text = "".join(plain_parts).strip()
    target = extract_hyperlink_target(instr)
    if target and html_text:
        return (
            f'<a href="{escape(target)}" target="_blank" rel="noopener noreferrer">{html_text}</a>',
            f"{plain_text} ({target})" if plain_text else target,
            images,
        )
    return html_text, plain_text, images


def build_field_link(instr: str, html_parts, plain_parts, images):
    html_text = "".join(html_parts).strip()
    plain_text = "".join(plain_parts).strip()
    target = extract_hyperlink_target(instr)
    if target and html_text:
        return (
            f'<a href="{escape(target)}" target="_blank" rel="noopener noreferrer">{html_text}</a>',
            f"{plain_text} ({target})" if plain_text else target,
            images,
        )
    return html_text, plain_text, images


def extract_hyperlink_target(instr: str) -> str:
    if not instr:
        return ""
    match = re.search(r'HYPERLINK\s+"([^"]+)"', instr, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    match = re.search(r"HYPERLINK\s+([^\s]+)", instr, re.IGNORECASE)
    return match.group(1).strip() if match else ""


def parse_material_rows(rows, level):
    entries = []
    level_resources = []
    current_theme = {"code": "", "name": ""}
    current_subtheme = {"code": "", "name": ""}
    previous = {
        "can_do": empty_cell(),
        "mode": empty_cell(),
        "topic": empty_cell(),
        "core_words": empty_cell(),
        "related_words": empty_cell(),
        "sample": empty_cell(),
    }
    collecting = False

    for row in rows:
        row = row + [empty_cell()] * (6 - len(row))
        cells = row[:6]
        cell_texts = [normalize_space(cell["text"]) for cell in cells]
        first = cell_texts[0]

        if first.startswith("主题"):
            current_theme = split_code_and_name(first.replace("主题", "", 1))
            current_subtheme = {"code": "", "name": ""}
            continue

        if first.startswith("子主题"):
            current_subtheme = split_code_and_name(first.replace("子主题", "", 1))
            continue

        if "能做示例" in first or "“能做”示例" in first:
            collecting = True
            previous = {
                "can_do": empty_cell(),
                "mode": empty_cell(),
                "topic": empty_cell(),
                "core_words": empty_cell(),
                "related_words": empty_cell(),
                "sample": empty_cell(),
            }
            continue

        if not collecting:
            continue

        if not any(cell_texts):
            continue

        can_do_cell = cells[0] if cells[0]["text"] else previous["can_do"]
        mode_cell = cells[1] if cells[1]["text"] else previous["mode"]
        topic_cell = cells[2] if cells[2]["text"] else previous["topic"]
        core_cell = cells[3] if cells[3]["text"] else previous["core_words"]
        related_cell = cells[4] if cells[4]["text"] else previous["related_words"]
        sample_cell = cells[5] if (cells[5]["text"] or cells[5]["images"]) else previous["sample"]

        if is_level_resource(can_do_cell["text"], mode_cell["text"]):
            level_resources.append(
                {
                    "level": level,
                    "title": normalize_space(can_do_cell["text"]),
                    "content": normalize_multiline(mode_cell["text"]),
                }
            )
            previous = {
                "can_do": can_do_cell,
                "mode": mode_cell,
                "topic": topic_cell,
                "core_words": core_cell,
                "related_words": related_cell,
                "sample": sample_cell,
            }
            continue

        normalized_mode = normalize_mode(mode_cell["text"])
        if not normalized_mode or normalized_mode.startswith("子主题"):
            normalized_mode = infer_mode_from_can_do(can_do_cell["text"])

        record = {
            "level": level,
            "themeCode": current_theme["code"],
            "themeName": current_theme["name"],
            "subthemeCode": current_subtheme["code"],
            "subthemeName": current_subtheme["name"],
            "canDo": can_do_cell["text"],
            "mode": normalized_mode,
            "topicRaw": topic_cell["text"],
            "coreWords": core_cell["text"],
            "relatedWords": related_cell["text"],
            "sample": sample_cell["text"],
            "sampleHtml": sample_cell["html"],
            "sampleImages": sample_cell["images"],
        }

        topic = split_code_and_name(record["topicRaw"])
        record["topicCode"] = topic["code"]
        record["topicName"] = topic["name"]
        record["id"] = f"{level}|{record['themeCode']}|{record['subthemeCode']}|{record['topicCode']}|{len(entries)+1}"

        entries.append(record)
        previous = {
            "can_do": can_do_cell,
            "mode": mode_cell,
            "topic": topic_cell,
            "core_words": core_cell,
            "related_words": related_cell,
            "sample": sample_cell,
        }

    return entries, level_resources


def build_dataset():
    files = sorted(
        path
        for path in SOURCE_DIR.glob("2026_ACTFL_Vocabulary_*.docx")
        if not path.name.startswith("~$")
    )

    entries = []
    level_resources = []
    for path in files:
        level = infer_level(path.name)
        rows = read_docx_table_rows(path)
        parsed_entries, parsed_resources = parse_material_rows(rows, level)
        entries.extend(parsed_entries)
        level_resources.extend(parsed_resources)

    topic_name_map = {}
    for item in entries:
        if item["topicCode"] and item["topicName"]:
            topic_name_map[item["topicCode"]] = item["topicName"]

    normalized_entries = []
    for item in entries:
        can_do = normalize_space(item["canDo"])
        if can_do == "功能词" or can_do.startswith("功能词"):
            continue

        if item["topicCode"] and not item["topicName"]:
            item["topicName"] = topic_name_map.get(item["topicCode"], "")

        related_clean = normalize_multiline(item["relatedWords"])
        sample_clean = normalize_multiline(item["sample"])
        looks_like_sample = (
            not sample_clean
            and len(related_clean) > 120
            and ("\n\n" in related_clean or "：" in related_clean or "？" in related_clean)
            and "(AH" not in related_clean
            and "(AM" not in related_clean
            and "(AL" not in related_clean
            and "(IH" not in related_clean
            and "(IM" not in related_clean
            and "(IL" not in related_clean
            and "(NH" not in related_clean
            and "(NM" not in related_clean
            and "(NL" not in related_clean
        )

        if looks_like_sample:
            item["sample"] = item["relatedWords"]
            item["sampleHtml"] = "".join(f"<p>{escape(paragraph)}</p>" for paragraph in related_clean.split("\n\n") if paragraph.strip())
            item["relatedWords"] = ""

        normalized_entries.append(item)

    entries = normalized_entries

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
        "levelResources": level_resources,
    }

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
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
