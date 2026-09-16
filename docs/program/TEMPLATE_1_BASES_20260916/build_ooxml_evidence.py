from __future__ import annotations

import re
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
R = "http://schemas.openxmlformats.org/package/2006/relationships"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
ET.register_namespace("w", W)
ET.register_namespace("a", A)
ET.register_namespace("", S)


def q(ns: str, name: str) -> str:
    return f"{{{ns}}}{name}"


def rewrite_zip(source: Path, target: Path, mutator) -> dict[str, int]:
    counts: dict[str, int] = {}
    with tempfile.TemporaryDirectory() as temp_dir:
        root = Path(temp_dir)
        with zipfile.ZipFile(source) as archive:
            archive.extractall(root)
        mutator(root, counts)
        target.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(root.rglob("*")):
                if path.is_file():
                    archive.write(path, path.relative_to(root).as_posix())
    return counts


def write_xml(path: Path, tree: ET.ElementTree) -> None:
    tree.write(path, encoding="UTF-8", xml_declaration=True)


def patch_docx(root: Path, counts: dict[str, int], theme_donor: Path) -> None:
    theme_path = root / "word/theme/theme1.xml"
    if not theme_path.exists():
        theme_path.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(theme_donor) as donor:
            theme_path.write_bytes(donor.read("word/theme/theme1.xml"))

        rels_path = root / "word/_rels/document.xml.rels"
        rels = rels_path.read_bytes()
        if b"/relationships/theme" not in rels:
            used_ids = {int(value) for value in re.findall(rb'Id="rId(\d+)"', rels)}
            index = 1
            while index in used_ids:
                index += 1
            relationship = (
                f'<Relationship Id="rId{index}" '
                'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" '
                'Target="theme/theme1.xml"/>'
            ).encode()
            rels_path.write_bytes(rels.replace(b"</Relationships>", relationship + b"</Relationships>"))

        types_path = root / "[Content_Types].xml"
        types = types_path.read_bytes()
        if b'/word/theme/theme1.xml' not in types:
            override = (
                b'<Override PartName="/word/theme/theme1.xml" '
                b'ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
            )
            types_path.write_bytes(types.replace(b"</Types>", override + b"</Types>"))
    theme_xml = theme_path.read_bytes()
    theme_xml, major_count = re.subn(
        rb'(<a:majorFont>.*?<a:latin\b[^>]*\btypeface=")[^"]*',
        rb'\1Aptos Display', theme_xml, count=1, flags=re.DOTALL,
    )
    theme_xml, minor_count = re.subn(
        rb'(<a:minorFont>.*?<a:latin\b[^>]*\btypeface=")[^"]*',
        rb'\1Aptos', theme_xml, count=1, flags=re.DOTALL,
    )
    if major_count != 1 or minor_count != 1:
        raise RuntimeError("DOCX theme has no major/minor latin fonts")
    theme_path.write_bytes(theme_xml)
    counts["docx_theme_fonts"] = 2

    font_table_path = root / "word/fontTable.xml"
    font_xml = font_table_path.read_bytes()
    if b"</w:fonts>" not in font_xml:
        font_xml = font_xml.rstrip()
        if not font_xml.endswith(b"/>"):
            raise RuntimeError("DOCX fontTable root is neither closed nor self-closing")
        font_xml = font_xml[:-2] + b"></w:fonts>"
    for name in ("Aptos", "Aptos Display"):
        encoded_name = name.encode()
        if b'w:name="' + encoded_name + b'"' not in font_xml:
            font = b'<w:font w:name="' + encoded_name + b'"><w:altName w:val="Arial"/></w:font>'
            font_xml = font_xml.replace(b"</w:fonts>", font + b"</w:fonts>")
    font_table_path.write_bytes(font_xml)
    counts["docx_font_alt_names"] = 2

    changed = 0

    def replace_fonts(match: re.Match[bytes]) -> bytes:
        nonlocal changed
        tag = match.group(0)
        for attr in (
            b"ascii", b"hAnsi", b"eastAsia", b"cs",
            b"asciiTheme", b"hAnsiTheme", b"eastAsiaTheme", b"cstheme",
        ):
            tag, removed = re.subn(rb"\s+w:" + attr + rb'="[^"]*"', b"", tag)
            changed += removed
        return tag[:-2] + (
            b' w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"'
            b' w:eastAsiaTheme="minorEastAsia" w:cstheme="minorBidi"/>'
        )

    for path in sorted((root / "word").rglob("*.xml")):
        if path in (theme_path, font_table_path):
            continue
        original = path.read_bytes()
        updated = re.sub(rb"<w:rFonts\b[^>]*/>", replace_fonts, original)
        if updated != original:
            path.write_bytes(updated)
    counts["docx_literal_font_attributes_removed"] = changed


def patch_xlsx(root: Path, counts: dict[str, int]) -> None:
    theme_path = root / "xl/theme/theme1.xml"
    theme = ET.parse(theme_path)
    major = theme.find(f".//{q(A, 'majorFont')}/{q(A, 'latin')}")
    minor = theme.find(f".//{q(A, 'minorFont')}/{q(A, 'latin')}")
    if major is None or minor is None:
        raise RuntimeError("XLSX theme has no major/minor latin fonts")
    major.set("typeface", "Aptos Display")
    minor.set("typeface", "Aptos")
    write_xml(theme_path, theme)
    counts["xlsx_theme_fonts"] = 2

    changed = 0
    candidates = [root / "xl/styles.xml"]
    candidates.extend((root / "xl/worksheets").glob("*.xml"))
    shared_strings = root / "xl/sharedStrings.xml"
    if shared_strings.exists():
        candidates.append(shared_strings)
    for path in candidates:
        tree = ET.parse(path)
        parent_map = {child: parent for parent in tree.iter() for child in parent}
        file_changed = False
        for name in list(tree.findall(f".//{q(S, 'name')}")):
            parent = parent_map.get(name)
            if parent is not None and parent.tag in (q(S, "font"), q(S, "rPr")):
                parent.remove(name)
                if parent.find(q(S, "scheme")) is None:
                    ET.SubElement(parent, q(S, "scheme"), {"val": "minor"})
                changed += 1
                file_changed = True
        if file_changed:
            write_xml(path, tree)
    counts["xlsx_literal_font_names_removed"] = changed


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: build_ooxml_evidence.py SOURCE_DIR OUTPUT_DIR DOCX_THEME_DONOR")
    source_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    theme_donor = Path(sys.argv[3])
    output_dir.mkdir(parents=True, exist_ok=True)
    docx_counts = rewrite_zip(
        source_dir / "client-final-report.docx",
        output_dir / "client-final-report-template-1.docx",
        lambda root, counts: patch_docx(root, counts, theme_donor),
    )
    xlsx_counts = rewrite_zip(
        source_dir / "supplier-scorecard.xlsx",
        output_dir / "supplier-scorecard-template-1.xlsx",
        patch_xlsx,
    )
    print({"docx": docx_counts, "xlsx": xlsx_counts})


if __name__ == "__main__":
    main()
