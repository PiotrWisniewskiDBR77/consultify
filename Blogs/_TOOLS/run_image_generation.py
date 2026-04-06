from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_QUEUE = ROOT / "_WORK" / "image_ops" / "DBR77_IMAGE_GENERATION_QUEUE.csv"
DEFAULT_LOG = ROOT / "_WORK" / "image_ops" / "DBR77_IMAGE_GENERATION_LOG.jsonl"
DEFAULT_ENV_FILE = ROOT / "_TOOLS" / ".env.image-generation"
HEADING_ORDER = ("Hero", "Analytical", "Social")


@dataclass(frozen=True)
class QueueRow:
    product: str
    scope_type: str
    asset_slug: str
    role: str
    source_prompt_path: str
    source_status: str
    generation_action: str
    recommended_priority: str
    is_archive: bool
    active_generation_target: bool
    output_dir: str
    output_filename: str
    meta_filename: str
    usage: tuple[str, ...]


@dataclass(frozen=True)
class ParsedPrompt:
    role_heading: str
    objective: str
    thesis: str
    prompt_text: str
    negative_prompt: str
    aspect_ratio: str
    usage: tuple[str, ...]
    alt_text_en: str
    caption_en: str
    crop_safe_notes: str


@dataclass(frozen=True)
class GenerationResult:
    image_bytes: bytes
    provider_name: str
    model_name: str
    prompt_text: str
    negative_prompt: str
    raw_response: dict[str, Any]


def parse_args() -> argparse.Namespace:
    pre_parser = argparse.ArgumentParser(add_help=False)
    pre_parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE)
    pre_args, remaining = pre_parser.parse_known_args()
    load_env_file(pre_args.env_file)

    parser = argparse.ArgumentParser(description="Generate DBR77 images from the queue.")
    parser.add_argument("--env-file", type=Path, default=pre_args.env_file)
    parser.add_argument("--provider", choices=("google", "openai"), default=os.getenv("DBR77_IMAGE_PROVIDER", "google"))
    parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)
    parser.add_argument("--product")
    parser.add_argument("--role", choices=("hero", "analytical", "social"))
    parser.add_argument("--slug")
    parser.add_argument("--priority")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--include-archive", action="store_true")
    parser.add_argument("--include-non-active", action="store_true")
    parser.add_argument("--allow-non-generate-now", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--rerender", action="store_true", help="Write next available vN file instead of skipping existing outputs.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite the target filename if it already exists.")
    parser.add_argument("--log-file", type=Path, default=DEFAULT_LOG)
    parser.add_argument("--openai-model", default=os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1.5"))
    parser.add_argument("--google-model", default=os.getenv("GOOGLE_IMAGE_MODEL", "imagen-4.0-generate-001"))
    parser.add_argument("--openai-quality", default=os.getenv("OPENAI_IMAGE_QUALITY", "high"))
    parser.add_argument("--google-safety", default=os.getenv("GOOGLE_IMAGE_SAFETY", "block_medium_and_above"))
    return parser.parse_args(remaining)


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and (key not in os.environ or not os.environ[key].strip()):
            os.environ[key] = value


def read_queue(path: Path) -> list[QueueRow]:
    with path.open(encoding="utf-8", newline="") as handle:
        rows = []
        for raw in csv.DictReader(handle):
            rows.append(
                QueueRow(
                    product=raw["product"],
                    scope_type=raw["scope_type"],
                    asset_slug=raw["asset_slug"],
                    role=raw["role"],
                    source_prompt_path=raw["source_prompt_path"],
                    source_status=raw["source_status"],
                    generation_action=raw["generation_action"],
                    recommended_priority=raw["recommended_priority"],
                    is_archive=raw["is_archive"].lower() == "true",
                    active_generation_target=raw["active_generation_target"].lower() == "true",
                    output_dir=raw["output_dir"],
                    output_filename=raw["output_filename"],
                    meta_filename=raw["meta_filename"],
                    usage=tuple(part for part in raw["usage"].split("|") if part),
                )
            )
    return rows


def filter_rows(rows: list[QueueRow], args: argparse.Namespace) -> list[QueueRow]:
    filtered = []
    for row in rows:
        if args.product and row.product != args.product:
            continue
        if args.role and row.role != args.role:
            continue
        if args.slug and row.asset_slug != args.slug:
            continue
        if args.priority and row.recommended_priority != args.priority:
            continue
        if not args.include_archive and row.is_archive:
            continue
        if not args.include_non_active and not row.active_generation_target:
            continue
        if not args.allow_non_generate_now and row.generation_action != "generate_now":
            continue
        filtered.append(row)
    if args.limit is not None:
        return filtered[: args.limit]
    return filtered


def extract_role_block(markdown: str, heading: str) -> str:
    next_headings = [item for item in HEADING_ORDER if item != heading]
    pattern = rf"^##\s*{heading}\b\s*(.*?)(?=^##\s*(?:{'|'.join(next_headings)})\b|\Z)"
    match = re.search(pattern, markdown, re.MULTILINE | re.DOTALL)
    if not match:
        raise ValueError(f"Could not find role heading '{heading}' in prompt file.")
    return match.group(1).strip()


def normalize_key(raw: str) -> str:
    key = raw.strip().lower().replace("/", " ").replace("-", " ")
    key = re.sub(r"\s+", "_", key)
    aliases = {
        "visual_style": "style",
        "brand_mood": "brand_mood",
        "negative_prompts": "negative_prompt",
        "negative_prompt": "negative_prompt",
        "avoid": "negative_prompt",
        "framing": "composition",
        "details": "details",
        "optional_variant": "optional_variant",
        "aspect_ratio": "aspect_ratio",
        "thesis_to_visualize": "thesis",
    }
    return aliases.get(key, key)


def parse_fields(block: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    current_key: str | None = None
    for raw_line in block.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = re.match(r"^(?:-\s*)?([A-Za-z][A-Za-z0-9 /_-]*?):\s*(.*)$", line)
        if match:
            current_key = normalize_key(match.group(1))
            value = match.group(2).strip()
            fields[current_key] = value
            continue
        if current_key:
            prior = fields.get(current_key, "")
            fields[current_key] = f"{prior} {line}".strip()
        else:
            fields.setdefault("body", "")
            fields["body"] = f"{fields['body']} {line}".strip()
    return fields


def build_prompt_text(role: str, fields: dict[str, str]) -> str:
    pieces: list[str] = []
    thesis = fields.get("thesis", "")
    if thesis:
        pieces.append(f"Visualize this thesis: {thesis}")

    prompt_body = fields.get("prompt", "").strip()
    if prompt_body:
        pieces.append(prompt_body)
    else:
        objective = fields.get("objective", "").strip()
        scene = fields.get("scene", "").strip()
        structure = fields.get("structure", "").strip()
        composition = fields.get("composition", "").strip()
        style = fields.get("style", "").strip()
        brand_mood = fields.get("brand_mood", "").strip()
        details = fields.get("details", "").strip()
        if objective:
            pieces.append(objective)
        if scene:
            pieces.append(scene)
        if structure and role == "analytical":
            pieces.append(f"Structure: {structure}")
        if composition:
            pieces.append(composition)
        if details:
            pieces.append(details)
        if style:
            pieces.append(style)
        if brand_mood:
            pieces.append(f"Mood: {brand_mood}")

    constraints = fields.get("constraints", "").strip()
    if constraints:
        pieces.append(constraints)

    aspect_ratio = fields.get("aspect_ratio", "").strip()
    if aspect_ratio:
        pieces.append(f"Target aspect ratio: {aspect_ratio}")

    body = fields.get("body", "").strip()
    if body:
        pieces.append(body)

    pieces.append(text_suppression_instructions(role))
    if role == "analytical":
        pieces.append(analytical_rendering_instructions())

    return " ".join(piece.strip() for piece in pieces if piece.strip())


def text_suppression_instructions(role: str) -> str:
    role_hint = {
        "hero": "Use environmental storytelling and people, not presentation slides or readable screens.",
        "analytical": "Use unlabeled structure, simple shapes, tokens, lanes, connectors, and status cues instead of screenshot-like dashboards or reports.",
        "social": "Keep the focal object simple, bold, and centered without visible interface copy or poster-like headline treatment.",
    }.get(role, "")
    return (
        "Critical render rule: do not generate any readable text, letters, numbers, captions, labels, logos, watermarks, slide titles, "
        "document copy, dashboard copy, UI text, headline text, wall text, or typographic overlays anywhere in the image. "
        "If a screen, board, document, dashboard, scorecard, or interface is visible, it must contain only abstract non-readable blocks, "
        "simple shapes, and soft placeholder marks. Never place large title words, marketing slogans, section headers, or composited text "
        "for later overlay; leave that area visually quiet and empty instead. "
        f"{role_hint}"
    )


def analytical_rendering_instructions() -> str:
    return (
        "Analytical image rule: avoid screenshot aesthetics, whiteboard snapshots, slide decks, tables with headers, and infographic panels with text. "
        "Prefer a premium enterprise visual metaphor built from cards, modules, flows, physical markers, subtle charts without labels, and clean operational structure. "
        "Do not label stages directly inside the image; represent system stages through position, grouping, material contrast, and abstract markers only."
    )


def infer_alt_text(role: str, fields: dict[str, str]) -> str:
    thesis = fields.get("thesis", "").strip()
    scene = fields.get("scene", "").strip()
    objective = fields.get("objective", "").strip()
    lead = thesis or objective or f"{role.title()} image for DBR77."
    if scene:
        return f"{lead} Scene: {scene}"
    return lead


def infer_caption(fields: dict[str, str]) -> str:
    return fields.get("thesis", "").strip() or fields.get("objective", "").strip() or "DBR77 image asset."


def infer_crop_notes(role: str, aspect_ratio: str) -> str:
    if role == "social":
        return f"Primary subject should remain center-safe for {aspect_ratio} reuse."
    return f"Composed for {aspect_ratio}. Use the social role for square-first reuse."


def parse_prompt_file(prompt_path: Path, role: str, usage: tuple[str, ...]) -> ParsedPrompt:
    markdown = prompt_path.read_text(encoding="utf-8")
    heading = role.title()
    block = extract_role_block(markdown, heading)
    fields = parse_fields(block)
    prompt_text = build_prompt_text(role, fields)
    negative_prompt = fields.get("negative_prompt", "").strip()
    aspect_ratio = fields.get("aspect_ratio", "").strip() or ("1:1" if role == "social" else "16:9")
    return ParsedPrompt(
        role_heading=heading,
        objective=fields.get("objective", "").strip(),
        thesis=fields.get("thesis", "").strip(),
        prompt_text=prompt_text,
        negative_prompt=negative_prompt,
        aspect_ratio=aspect_ratio,
        usage=usage,
        alt_text_en=infer_alt_text(role, fields),
        caption_en=infer_caption(fields),
        crop_safe_notes=infer_crop_notes(role, aspect_ratio),
    )


def next_version_name(filename: str, target_dir: Path) -> str:
    match = re.search(r"_v(\d+)(\.[^.]+)$", filename)
    if not match:
        return filename
    prefix = filename[: match.start()]
    extension = match.group(2)
    version = int(match.group(1))
    candidate = filename
    while (target_dir / candidate).exists():
        version += 1
        candidate = f"{prefix}_v{version}{extension}"
    return candidate


def target_paths(row: QueueRow, root: Path, rerender: bool, overwrite: bool) -> tuple[Path, Path]:
    target_dir = root / row.output_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    image_name = row.output_filename
    meta_name = row.meta_filename
    if rerender:
        image_name = next_version_name(image_name, target_dir)
        meta_name = image_name.rsplit(".", 1)[0] + ".meta.json"
    elif not overwrite and (target_dir / image_name).exists():
        raise FileExistsError(f"Target image already exists: {target_dir / image_name}")
    return target_dir / image_name, target_dir / meta_name


def crop_to_aspect(image: Image.Image, aspect_ratio: str) -> Image.Image:
    width, height = image.size
    target_w, target_h = [int(part) for part in aspect_ratio.split(":")]
    target_ratio = target_w / target_h
    current_ratio = width / height

    if abs(current_ratio - target_ratio) < 0.005:
        return image

    if current_ratio > target_ratio:
        new_width = int(height * target_ratio)
        left = (width - new_width) // 2
        return image.crop((left, 0, left + new_width, height))

    new_height = int(width / target_ratio)
    top = (height - new_height) // 2
    return image.crop((0, top, width, top + new_height))


def normalize_png(image_bytes: bytes, aspect_ratio: str) -> bytes:
    with Image.open(BytesIO(image_bytes)) as image:
        cropped = crop_to_aspect(image, aspect_ratio)
        if cropped.mode not in ("RGB", "RGBA"):
            cropped = cropped.convert("RGBA")
        buffer = BytesIO()
        cropped.save(buffer, format="PNG")
        return buffer.getvalue()


class ProviderError(RuntimeError):
    pass


class BaseProvider:
    def generate(self, prompt: ParsedPrompt) -> GenerationResult:
        raise NotImplementedError


class OpenAIProvider(BaseProvider):
    def __init__(self, model: str, quality: str) -> None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ProviderError("OPENAI_API_KEY is not set.")
        self.api_key = api_key
        self.model = model
        self.quality = quality
        self.url = "https://api.openai.com/v1/images/generations"

    def _size_for_ratio(self, aspect_ratio: str) -> str:
        return {
            "1:1": "1024x1024",
            "16:9": "1536x1024",
            "4:5": "1024x1536",
            "3:2": "1536x1024",
            "2:3": "1024x1536",
        }.get(aspect_ratio, "1024x1024")

    def generate(self, prompt: ParsedPrompt) -> GenerationResult:
        payload = {
            "model": self.model,
            "prompt": prompt.prompt_text,
            "size": self._size_for_ratio(prompt.aspect_ratio),
            "quality": self.quality,
        }
        request = urllib.request.Request(
            self.url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request) as response:
                raw = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise ProviderError(f"OpenAI request failed: {exc.code} {body}") from exc
        except urllib.error.URLError as exc:
            raise ProviderError(f"OpenAI request failed: {exc}") from exc

        b64_json = raw["data"][0]["b64_json"]
        image_bytes = base64.b64decode(b64_json)
        normalized = normalize_png(image_bytes, prompt.aspect_ratio)
        return GenerationResult(
            image_bytes=normalized,
            provider_name="openai",
            model_name=self.model,
            prompt_text=prompt.prompt_text,
            negative_prompt=prompt.negative_prompt,
            raw_response=raw,
        )


class GoogleProvider(BaseProvider):
    def __init__(self, model: str, safety_setting: str) -> None:
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ProviderError("Set GOOGLE_API_KEY or GEMINI_API_KEY.")
        self.api_key = api_key
        self.model = model
        self.safety_setting = safety_setting
        self.url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:predict"

    def _request_prompt(self, prompt: ParsedPrompt) -> str:
        google_suffix = (
            "Google-specific output rule: produce a photorealistic or editorial-realistic business image with no readable text anywhere. "
            "Do not place words on walls, tables, screens, reports, dashboards, scorecards, or overlays. "
            "Any interface elements must stay abstract, minimal, and completely non-legible."
        )
        if prompt.negative_prompt:
            return f"{prompt.prompt_text} {google_suffix} Avoid: {prompt.negative_prompt}"
        return f"{prompt.prompt_text} {google_suffix}"

    def generate(self, prompt: ParsedPrompt) -> GenerationResult:
        return self._generate_with_safety(prompt, self.safety_setting)

    def _generate_with_safety(self, prompt: ParsedPrompt, safety_setting: str) -> GenerationResult:
        payload = {
            "instances": [{"prompt": self._request_prompt(prompt)}],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": prompt.aspect_ratio,
                "personGeneration": "allow_adult",
                "safetySetting": safety_setting,
                "outputOptions": {"mimeType": "image/png"},
            },
        }
        request = urllib.request.Request(
            self.url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "x-goog-api-key": self.api_key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request) as response:
                raw = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if (
                exc.code == 400
                and safety_setting != "block_low_and_above"
                and "Only block_low_and_above is supported for safetySetting." in body
            ):
                return self._generate_with_safety(prompt, "block_low_and_above")
            raise ProviderError(f"Google request failed: {exc.code} {body}") from exc
        except urllib.error.URLError as exc:
            raise ProviderError(f"Google request failed: {exc}") from exc

        predictions = raw.get("predictions", [])
        if not predictions:
            raise ProviderError(f"Google request returned no predictions: {raw}")
        image_b64 = predictions[0].get("bytesBase64Encoded")
        if not image_b64:
            raise ProviderError(f"Google prediction missing image bytes: {predictions[0]}")
        image_bytes = base64.b64decode(image_b64)
        normalized = normalize_png(image_bytes, prompt.aspect_ratio)
        return GenerationResult(
            image_bytes=normalized,
            provider_name="google",
            model_name=self.model,
            prompt_text=self._request_prompt(prompt),
            negative_prompt=prompt.negative_prompt,
            raw_response=raw,
        )


def build_provider(args: argparse.Namespace) -> BaseProvider:
    if args.provider == "openai":
        return OpenAIProvider(model=args.openai_model, quality=args.openai_quality)
    return GoogleProvider(model=args.google_model, safety_setting=args.google_safety)


def write_sidecar(
    meta_path: Path,
    row: QueueRow,
    prompt: ParsedPrompt,
    result: GenerationResult,
    image_path: Path,
) -> None:
    payload = {
        "article_path": str(Path("Blogs") / row.output_dir).rsplit("/assets/images", 1)[0],
        "product": row.product,
        "scope_type": row.scope_type,
        "asset_slug": row.asset_slug,
        "role": row.role,
        "aspect_ratio": prompt.aspect_ratio,
        "usage": list(prompt.usage),
        "model": f"{result.provider_name}:{result.model_name}",
        "prompt_source": str(Path("Blogs") / row.source_prompt_path),
        "prompt_text": result.prompt_text,
        "negative_prompt": result.negative_prompt,
        "seed": "n/a",
        "run_id": "n/a",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "alt_text_en": prompt.alt_text_en,
        "caption_en": prompt.caption_en,
        "crop_safe_notes": prompt.crop_safe_notes,
        "output_path": str(image_path.relative_to(ROOT.parent)),
    }
    meta_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def append_log(log_path: Path, entry: dict[str, Any]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=True) + "\n")


def process_row(row: QueueRow, args: argparse.Namespace, provider: BaseProvider) -> dict[str, Any]:
    prompt_path = ROOT / row.source_prompt_path
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file does not exist: {prompt_path}")

    prompt = parse_prompt_file(prompt_path, row.role, row.usage)
    image_path, meta_path = target_paths(row, ROOT, rerender=args.rerender, overwrite=args.overwrite)

    if args.dry_run:
        return {
            "status": "dry_run",
            "product": row.product,
            "slug": row.asset_slug,
            "role": row.role,
            "image_path": str(image_path),
            "meta_path": str(meta_path),
            "provider": args.provider,
        }

    result = provider.generate(prompt)
    image_path.write_bytes(result.image_bytes)
    write_sidecar(meta_path, row, prompt, result, image_path)
    return {
        "status": "generated",
        "product": row.product,
        "slug": row.asset_slug,
        "role": row.role,
        "image_path": str(image_path),
        "meta_path": str(meta_path),
        "provider": args.provider,
    }


def main() -> int:
    args = parse_args()
    rows = read_queue(args.queue)
    selected = filter_rows(rows, args)
    if not selected:
        print("No queue rows matched the provided filters.", file=sys.stderr)
        return 1

    provider = None if args.dry_run else build_provider(args)
    generated = 0
    skipped = 0
    failed = 0

    for row in selected:
        try:
            result = process_row(row, args, provider)  # type: ignore[arg-type]
            print(json.dumps(result, ensure_ascii=True))
            append_log(args.log_file, result)
            if result["status"] == "generated":
                generated += 1
            else:
                skipped += 1
        except FileExistsError as exc:
            skipped += 1
            result = {
                "status": "skipped_existing",
                "product": row.product,
                "slug": row.asset_slug,
                "role": row.role,
                "reason": str(exc),
            }
            print(json.dumps(result, ensure_ascii=True))
            append_log(args.log_file, result)
        except Exception as exc:  # noqa: BLE001
            failed += 1
            result = {
                "status": "failed",
                "product": row.product,
                "slug": row.asset_slug,
                "role": row.role,
                "reason": str(exc),
            }
            print(json.dumps(result, ensure_ascii=True), file=sys.stderr)
            append_log(args.log_file, result)

    summary = {
        "status": "summary",
        "provider": args.provider,
        "selected_rows": len(selected),
        "generated": generated,
        "skipped": skipped,
        "failed": failed,
        "dry_run": args.dry_run,
    }
    print(json.dumps(summary, ensure_ascii=True))
    append_log(args.log_file, summary)
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
