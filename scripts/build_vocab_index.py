import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent.parent
SOURCE_FILE = ROOT / "2026_ACTFL_Vocabulary_WithFilters.xlsx"
OUTPUT_FILE = ROOT / "site" / "vocab-index.json"

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "p": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def read_shared_strings(archive):
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(t.text or "" for t in si.iterfind(".//a:t", NS))
        for si in root.findall("a:si", NS)
    ]


def read_rows():
    with zipfile.ZipFile(SOURCE_FILE) as archive:
        shared = read_shared_strings(archive)
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall(".//a:sheetData/a:row", NS):
            values = []
            for cell in row.findall("a:c", NS):
                cell_type = cell.attrib.get("t")
                v = cell.find("a:v", NS)
                if v is None:
                    values.append("")
                elif cell_type == "s":
                    values.append(shared[int(v.text)])
                else:
                    values.append(v.text)
            rows.append(values)
        return rows


def build_index():
    rows = read_rows()
    header = rows[0]
    items = []
    for row in rows[1:]:
        row = row + [""] * (len(header) - len(row))
        record = dict(zip(header, row))
        items.append(
            {
                "word": record.get("词语", "").strip(),
                "pos": record.get("词性", "").strip(),
                "actfl": record.get("ACTFL等级", "").strip(),
                "hsk": record.get("HSK等级", "").strip(),
                "pg": record.get("PG等级", "").strip(),
                "basicEdu": record.get("义务教育等级", "").strip(),
            }
        )

    payload = {
        "summary": {
            "count": len(items),
        },
        "items": items,
    }
    OUTPUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote vocab index to {OUTPUT_FILE}")


if __name__ == "__main__":
    build_index()
