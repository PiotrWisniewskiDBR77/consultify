from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent

PRODUCTS = ("Consultify", "IoT", "IRIS", "DT", "Marketplace", "Vector")
REQUIRED_LOCALES = ("EN", "PL", "DE")

LAYER_NAMES = (
    "Layer 1: Field Reality",
    "Layer 2: Problem Deep Dives",
    "Layer 3: Solution Logic",
    "Layer 4: Decision Support",
    "Layer 5: Execution And Transformation",
)


@dataclass(frozen=True)
class ProductPaths:
    product: str
    blog_root: Path
    attachment_map: Path


def product_paths(product: str) -> ProductPaths:
    blog_root = ROOT / product / "Blog"
    attachment_map = blog_root / "00_LP_ATTACHMENT_CHECK_01_50.md"
    return ProductPaths(product=product, blog_root=blog_root, attachment_map=attachment_map)


META_RE = {
    "persona": re.compile(r"^Target persona:\s*(.+?)\s*$"),
    "stage": re.compile(r"^Funnel stage:\s*(.+?)\s*$"),
    "problem": re.compile(r"^Core problem:\s*(.+?)\s*$"),
    "promise": re.compile(r"^Main promise:\s*(.+?)\s*$"),
}
TITLE_RE = re.compile(r"^#\s+(.+?)\s*$")


def iter_article_dirs(blog_root: Path) -> list[Path]:
    dirs = []
    for p in blog_root.iterdir():
        if not p.is_dir():
            continue
        if p.name.startswith("00_") or p.name.startswith("_archive_"):
            continue
        if (p / "article_EN.md").exists():
            dirs.append(p)
    return sorted(dirs, key=lambda x: x.name)


def parse_article_en_meta(article_en_path: Path) -> dict[str, str]:
    text = article_en_path.read_text(encoding="utf-8")
    lines = text.splitlines()

    title = ""
    meta: dict[str, str] = {"title": "", "persona": "", "stage": "", "problem": "", "promise": ""}
    for line in lines[:40]:
        if not title:
            m = TITLE_RE.match(line)
            if m:
                title = m.group(1).strip()
                meta["title"] = title
                continue

        for key, regex in META_RE.items():
            m = regex.match(line)
            if m:
                meta[key] = m.group(1).strip()

    return meta


def parse_seo(seo_path: Path) -> dict[str, str]:
    if not seo_path.exists():
        return {"primary_keyword": ""}
    text = seo_path.read_text(encoding="utf-8")
    m = re.search(r"^Primary keyword:\s*(.+?)\s*$", text, flags=re.MULTILINE)
    return {"primary_keyword": (m.group(1).strip() if m else "")}


def parse_attachment_map(attachment_path: Path) -> dict[str, dict[str, str]]:
    """
    Parses the "Article Attachment Map" markdown table.
    Returns mapping: slug -> {lp_section, bridge}.
    """
    if not attachment_path.exists():
        return {}

    text = attachment_path.read_text(encoding="utf-8")
    rows: dict[str, dict[str, str]] = {}
    in_table = False
    for line in text.splitlines():
        if line.strip() == "## Article Attachment Map":
            in_table = True
            continue
        if in_table and line.startswith("## ") and "Article Attachment Map" not in line:
            break
        if not in_table:
            continue
        if not line.startswith("|"):
            continue
        if line.startswith("|---"):
            continue
        # | `slug` | `Section` | `Bridge` | ...
        cols = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cols) < 3:
            continue
        if cols[0].lower() == "article":
            continue
        slug = cols[0].strip("`").strip()
        section = cols[1].strip("`").strip()
        bridge = cols[2].strip("`").strip()
        if slug:
            rows[slug] = {"lp_section": section, "bridge": bridge}
    return rows


def score_layers(slug: str, title: str, persona: str, stage: str) -> list[float]:
    s = f"{slug} {title} {persona} {stage}".lower()
    scores = [0.0] * 5

    # Layer 5: execution / rollout / adoption
    if any(k in s for k in ("first 30", "first 90", "roll out", "rollout", "playbook", "review after", "monthly", "after the first", "implementation", "how to run", "go live", "kickoff")):
        scores[4] += 2.0
    if any(k in s for k in ("what to measure", "what to review", "how to start", "how to build step by step")):
        scores[4] += 1.0

    # Layer 4: decision support
    if any(k in s for k in ("roi", "business case", "capex", "board", "cfo", "compare", "vendor", "security", "audit", "risk", "procurement", "contract", "tco")):
        scores[3] += 2.0
    if "decision" in s or "approval" in s:
        scores[3] += 1.0

    # Layer 3: solution logic (how it works / how to)
    if any(k in s for k in ("how to", "when to", "what a good", "what to", "guide", "checklist", "model", "architecture", "framework")):
        scores[2] += 1.5

    # Layer 2: deep dives (specific problem mechanisms)
    if any(k in s for k in ("why", "hidden cost", "fails", "bottleneck", "false alarms", "overloaded", "latency", "spreadsheets", "dashboards", "myth", "still run")):
        scores[1] += 1.2

    # Layer 1: field reality (plant-side reality, patterns, symptoms)
    if any(k in s for k in ("plants", "factory", "shift", "operators", "downtime", "oee", "shop floor", "brownfield")):
        scores[0] += 1.0
    if any(k in s for k in ("reality check", "what actually happens", "in many factories", "in many plants")):
        scores[0] += 0.8

    # Awareness tends to bias toward layers 1-2; decision tends toward 4; adoption tends toward 5.
    if stage.strip().lower() == "awareness":
        scores[0] += 0.3
        scores[1] += 0.3
    if stage.strip().lower() == "decision":
        scores[3] += 0.5
    if stage.strip().lower() in ("adoption", "implementation"):
        scores[4] += 0.5

    return scores


def assign_layers_balanced(items: list[dict[str, str]]) -> dict[str, str]:
    """
    Enforces 10 articles per layer by greedy assignment using per-item scores.
    items: list of dicts with keys slug,title,persona,stage.
    returns: slug -> layer_name
    """
    quota = {name: 10 for name in LAYER_NAMES}
    scored = []
    for it in items:
        scores = score_layers(it["slug"], it["title"], it["persona"], it["stage"])
        scored.append((max(scores), scores, it))
    scored.sort(key=lambda x: x[0], reverse=True)

    assignment: dict[str, str] = {}
    for _max_score, scores, it in scored:
        ranked = sorted(range(5), key=lambda i: scores[i], reverse=True)
        chosen = None
        for idx in ranked:
            layer = LAYER_NAMES[idx]
            if quota[layer] > 0:
                chosen = layer
                break
        if chosen is None:
            raise RuntimeError("Layer quotas exhausted unexpectedly.")
        quota[chosen] -= 1
        assignment[it["slug"]] = chosen

    if any(v != 0 for v in quota.values()):
        raise RuntimeError(f"Unfilled quotas: {quota}")
    return assignment


def load_overrides() -> dict[str, str]:
    override_path = ROOT / "_DATA" / "catalogs" / "DBR77_LAYER_OVERRIDES.json"
    if not override_path.exists():
        return {}
    data = json.loads(override_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("DBR77_LAYER_OVERRIDES.json must be a JSON object mapping slug -> layer name.")
    return {str(k): str(v) for k, v in data.items()}


def build() -> None:
    overrides = load_overrides()

    # Catalog output
    catalog_path = ROOT / "_DATA/catalogs/DBR77_CONTENT_CATALOG.csv"
    layer_summary_path = ROOT / "_DATA/catalogs/DBR77_LAYER_MAP_SUMMARY.csv"

    catalog_rows: list[dict[str, str]] = []
    summary_rows: list[dict[str, str]] = []

    for product in PRODUCTS:
        pp = product_paths(product)
        article_dirs = iter_article_dirs(pp.blog_root)

        attachment = parse_attachment_map(pp.attachment_map)

        items_for_layering: list[dict[str, str]] = []
        for d in article_dirs:
            slug = d.name
            article_meta = parse_article_en_meta(d / "article_EN.md")
            seo_meta = parse_seo(d / "seo.md")
            lp = attachment.get(slug, {"lp_section": "", "bridge": ""})
            items_for_layering.append(
                {
                    "product": product,
                    "slug": slug,
                    "title": article_meta["title"],
                    "persona": article_meta["persona"],
                    "stage": article_meta["stage"],
                    "problem": article_meta["problem"],
                    "promise": article_meta["promise"],
                    "primary_keyword": seo_meta["primary_keyword"],
                    "lp_section": lp["lp_section"],
                    "bridge": lp["bridge"],
                }
            )

        if len(items_for_layering) != 50:
            raise ValueError(f"{product}: expected 50 article dirs, found {len(items_for_layering)}")

        # Assign layers (balanced) + apply overrides
        base_assignment = assign_layers_balanced(items_for_layering)
        for slug, layer in overrides.items():
            if slug in base_assignment and layer in LAYER_NAMES:
                base_assignment[slug] = layer

        # Write per-product layer map
        product_layer_path = pp.blog_root / "00_KNOWLEDGE_LAYER_MAP_01_50.csv"
        with product_layer_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["slug", "knowledge_layer"])
            for it in sorted(items_for_layering, key=lambda x: x["slug"]):
                writer.writerow([it["slug"], base_assignment[it["slug"]]])

        # Summary counts
        counts = {name: 0 for name in LAYER_NAMES}
        for slug, layer in base_assignment.items():
            counts[layer] += 1
        for layer in LAYER_NAMES:
            summary_rows.append(
                {
                    "product": product,
                    "knowledge_layer": layer,
                    "count": str(counts[layer]),
                }
            )

        for it in items_for_layering:
            it["knowledge_layer"] = base_assignment[it["slug"]]
            catalog_rows.append(it)

    with catalog_path.open("w", newline="", encoding="utf-8") as handle:
        fieldnames = [
            "product",
            "slug",
            "title",
            "persona",
            "stage",
            "problem",
            "promise",
            "lp_section",
            "bridge",
            "knowledge_layer",
            "primary_keyword",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(catalog_rows)

    with layer_summary_path.open("w", newline="", encoding="utf-8") as handle:
        fieldnames = ["product", "knowledge_layer", "count"]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(summary_rows)

    print(f"Wrote {catalog_path}")
    print(f"Wrote {layer_summary_path}")
    print("Wrote per-product 00_KNOWLEDGE_LAYER_MAP_01_50.csv files.")


if __name__ == "__main__":
    build()

