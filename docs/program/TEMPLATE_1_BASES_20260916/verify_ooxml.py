from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def q(ns: str, name: str) -> str:
    return f"{{{ns}}}{name}"


def xml(archive: zipfile.ZipFile, name: str) -> ET.Element:
    return ET.fromstring(archive.read(name))


def docx_checks(path: Path) -> dict:
    with zipfile.ZipFile(path) as archive:
        theme = xml(archive, "word/theme/theme1.xml")
        styles = xml(archive, "word/styles.xml")
        font_table = xml(archive, "word/fontTable.xml")
        document = xml(archive, "word/document.xml")
        all_word_xml = [
            xml(archive, name)
            for name in archive.namelist()
            if name.startswith("word/") and name.endswith(".xml")
        ]
        major = theme.find(f".//{q(A, 'majorFont')}/{q(A, 'latin')}").get("typeface")
        minor = theme.find(f".//{q(A, 'minorFont')}/{q(A, 'latin')}").get("typeface")
        alt_names = {
            font.get(q(W, "name")): (font.find(q(W, "altName")).get(q(W, "val")) if font.find(q(W, "altName")) is not None else None)
            for font in font_table.findall(q(W, "font"))
        }
        literal_run_fonts = []
        themed_runs = 0
        for root in all_word_xml:
            for fonts in root.findall(f".//{q(W, 'rFonts')}"):
                literal_run_fonts.extend(
                    fonts.get(q(W, name)) for name in ("ascii", "hAnsi", "eastAsia", "cs")
                    if fonts.get(q(W, name))
                )
                if fonts.get(q(W, "asciiTheme")) == "minorHAnsi" and fonts.get(q(W, "hAnsiTheme")) == "minorHAnsi":
                    themed_runs += 1
        default_fonts = styles.find(f".//{q(W, 'docDefaults')}/{q(W, 'rPrDefault')}/{q(W, 'rPr')}/{q(W, 'rFonts')}")
        text = "".join(node.text or "" for node in document.findall(f".//{q(W, 't')}"))
        section_titles = [
            "Executive summary", "Context and scope", "Methodology", "Findings by axis",
            "Maturity matrix", "Recommendations", "Roadmap", "Appendix",
        ]
        checks = {
            "theme_major_aptos_display": major == "Aptos Display",
            "theme_minor_aptos": minor == "Aptos",
            "aptos_alt_name_arial": alt_names.get("Aptos") == "Arial",
            "aptos_display_alt_name_arial": alt_names.get("Aptos Display") == "Arial",
            "doc_defaults_minor_hansi": default_fonts is not None and default_fonts.get(q(W, "asciiTheme")) == "minorHAnsi" and default_fonts.get(q(W, "hAnsiTheme")) == "minorHAnsi",
            "no_literal_run_fonts": not literal_run_fonts,
            "theme_driven_runs_present": themed_runs > 0,
            "eight_section_titles_present": all(title in text for title in section_titles),
        }
        return {
            "majorLatin": major,
            "minorLatin": minor,
            "literalRunFonts": sorted(set(literal_run_fonts)),
            "themeDrivenRunDeclarations": themed_runs,
            "sectionTitleCount": sum(title in text for title in section_titles),
            "checks": checks,
            "status": "PASS" if all(checks.values()) else "FAIL",
        }


def xlsx_checks(path: Path) -> dict:
    with zipfile.ZipFile(path) as archive:
        theme = xml(archive, "xl/theme/theme1.xml")
        styles = xml(archive, "xl/styles.xml")
        workbook = xml(archive, "xl/workbook.xml")
        sheet1 = xml(archive, "xl/worksheets/sheet1.xml")
        major = theme.find(f".//{q(A, 'majorFont')}/{q(A, 'latin')}").get("typeface")
        minor = theme.find(f".//{q(A, 'minorFont')}/{q(A, 'latin')}").get("typeface")
        literal_font_names = [node.get("val") for node in styles.findall(f".//{q(S, 'fonts')}/{q(S, 'font')}/{q(S, 'name')}")]
        sheet_names = [node.get("name") for node in workbook.findall(f".//{q(S, 'sheet')}")]
        formulas = [node.text or "" for node in sheet1.findall(f".//{q(S, 'f')}")]
        pane = sheet1.find(f".//{q(S, 'pane')}")
        auto_filter = sheet1.find(q(S, "autoFilter"))
        conditional_ranges = [node.get("sqref") for node in sheet1.findall(q(S, "conditionalFormatting"))]
        checks = {
            "theme_major_aptos_display": major == "Aptos Display",
            "theme_minor_aptos": minor == "Aptos",
            "no_literal_cell_fonts": not literal_font_names,
            "two_sheets": sheet_names == ["Supplier scorecard", "Template fields"],
            "exact_formula_count": len(formulas) == 28,
            "freeze_2_by_6": pane is not None and pane.get("xSplit") == "2" and pane.get("ySplit") == "6",
            "accepted_autofilter": auto_filter is not None and auto_filter.get("ref") == "A6:K12",
            "accepted_conditional_format_ranges": conditional_ranges == ["H7:H11", "I7:I11", "J7:J12"],
        }
        return {
            "majorLatin": major,
            "minorLatin": minor,
            "literalCellFonts": literal_font_names,
            "sheets": sheet_names,
            "formulaCount": len(formulas),
            "conditionalFormattingRanges": conditional_ranges,
            "checks": checks,
            "status": "PASS" if all(checks.values()) else "FAIL",
        }


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: verify_ooxml.py DOCX XLSX OUTPUT_JSON")
    result = {
        "docx": docx_checks(Path(sys.argv[1])),
        "xlsx": xlsx_checks(Path(sys.argv[2])),
    }
    result["status"] = "PASS" if all(item["status"] == "PASS" for item in result.values()) else "FAIL"
    Path(sys.argv[3]).write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if result["status"] != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
