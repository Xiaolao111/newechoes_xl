#!/usr/bin/env python3
"""Sync one Obsidian 考研 note into the blog, including local images."""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}
MD_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(\s*<?([^>\s)]+)[^)]*\)")
WIKI_IMAGE_RE = re.compile(r"!\[\[([^\]|#]+)(?:\|([^\]]*))?\]\]")
HTML_IMAGE_RE = re.compile(r'(<img\b[^>]*\bsrc=["\'])([^"\']+)(["\'])', re.IGNORECASE)


def split_closed_frontmatter(text: str):
    if not text.startswith("---"):
        return None, text
    rest = text[3:]
    if rest.startswith("\n"):
        rest = rest[1:]
    marker = rest.find("\n---")
    if marker < 0:
        return None, text
    fm = rest[:marker]
    body = rest[marker + 4 :]
    if body.startswith("\n"):
        body = body[1:]
    return fm, body


def looks_like_yaml(fm: str) -> bool:
    lines = [ln for ln in fm.splitlines() if ln.strip()]
    if not lines:
        return False
    if lines[0].lstrip().startswith("#"):
        return False
    return any(
        (not ln.lstrip().startswith(("#", "- "))) and (":" in ln)
        for ln in lines
    )


def obsidian_body(text: str) -> str:
    fm, body = split_closed_frontmatter(text)
    if fm is not None and looks_like_yaml(fm):
        return body
    if text.startswith("---\n"):
        return text[4:]
    if text.startswith("---"):
        return text[3:].lstrip("\n")
    return text


def existing_frontmatter(text: str):
    fm, _ = split_closed_frontmatter(text)
    if fm is not None and looks_like_yaml(fm):
        return "---\n" + fm + "\n---\n"
    return None


def default_frontmatter(title: str, tags_csv: str) -> str:
    tz = timezone(timedelta(hours=8))
    now = datetime.now(tz).strftime("%Y-%m-%dT%H:%M:%S%z")
    now = now[:-2] + ":" + now[-2:]
    tags = [t.strip() for t in tags_csv.split(",") if t.strip()]
    lines = ["---", f"title: {title}", f"date: {now}", "tags:"]
    if tags:
        lines.extend(f"  - {tag}" for tag in tags)
    else:
        lines.append("  []")
    lines.append("---")
    return "\n".join(lines) + "\n"


def is_remote(url: str) -> bool:
    lowered = url.strip().lower()
    return lowered.startswith(("http://", "https://", "data:", "mailto:"))


def normalize_ref(raw: str) -> str:
    return unquote(raw.strip().strip("<>").split("?")[0].split("#")[0])


def extract_image_refs(text: str) -> list[str]:
    refs: list[str] = []
    for match in MD_IMAGE_RE.finditer(text):
        refs.append(match.group(2))
    for match in WIKI_IMAGE_RE.finditer(text):
        refs.append(match.group(1).strip())
    for match in HTML_IMAGE_RE.finditer(text):
        refs.append(match.group(2))
    seen: set[str] = set()
    unique: list[str] = []
    for ref in refs:
        key = normalize_ref(ref)
        if key and key not in seen:
            seen.add(key)
            unique.append(ref.strip())
    return unique


def filename_search(root: Path, name: str) -> Path | None:
    if not root.is_dir():
        return None
    direct = root / name
    if direct.is_file():
        return direct
    matches = [path for path in root.rglob(name) if path.is_file()]
    if not matches:
        return None
    matches.sort(key=lambda path: (len(path.parts), str(path)))
    return matches[0]


def resolve_image(note_dir: Path, vault_root: Path, ref: str) -> Path | None:
    cleaned = normalize_ref(ref)
    if not cleaned or is_remote(cleaned):
        return None
    path = Path(cleaned)
    name = path.name
    if path.suffix.lower() not in IMAGE_EXTS:
        return None

    candidates: list[Path] = []
    if path.is_absolute():
        candidates.append(path)
    else:
        candidates.extend(
            [
                (note_dir / cleaned).resolve(),
                (note_dir / name).resolve(),
                (note_dir / "figures" / name).resolve(),
                (note_dir / "attachments" / name).resolve(),
                (vault_root / cleaned).resolve(),
            ]
        )
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return filename_search(note_dir, name) or filename_search(vault_root, name)


def collect_sibling_images(note_dir: Path) -> list[Path]:
    found: list[Path] = []
    for folder in (note_dir / "figures", note_dir / "attachments", note_dir):
        if not folder.is_dir():
            continue
        iterator = folder.iterdir() if folder == note_dir else folder.rglob("*")
        for path in iterator:
            if path.is_file() and path.suffix.lower() in IMAGE_EXTS:
                found.append(path)
    return found


def public_url(dest_rel_stem: str, filename: str) -> str:
    return f"/images/{dest_rel_stem}/{filename}"


def copy_image(src: Path, dest_public_dir: Path) -> Path:
    dest_public_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_public_dir / src.name
    shutil.copy2(src, dest)
    return dest


def rewrite_images(text: str, replacements: dict[str, str]) -> str:
    if not replacements:
        return text

    def md_sub(match: re.Match[str]) -> str:
        alt, url = match.group(1), match.group(2)
        key = normalize_ref(url)
        new_url = replacements.get(key) or replacements.get(url.strip())
        if not new_url:
            return match.group(0)
        return f"![{alt}]({new_url})"

    def wiki_sub(match: re.Match[str]) -> str:
        raw, alt = match.group(1).strip(), match.group(2)
        key = normalize_ref(raw)
        new_url = replacements.get(key) or replacements.get(raw)
        if not new_url:
            return match.group(0)
        caption = (alt or Path(key).stem).strip()
        return f"![{caption}]({new_url})"

    def html_sub(match: re.Match[str]) -> str:
        prefix, url, suffix = match.group(1), match.group(2), match.group(3)
        key = normalize_ref(url)
        new_url = replacements.get(key) or replacements.get(url.strip())
        if not new_url:
            return match.group(0)
        return f"{prefix}{new_url}{suffix}"

    rewritten = MD_IMAGE_RE.sub(md_sub, text)
    rewritten = WIKI_IMAGE_RE.sub(wiki_sub, rewritten)
    rewritten = HTML_IMAGE_RE.sub(html_sub, rewritten)
    return rewritten


def sync_images(
    *,
    body: str,
    note_dir: Path,
    vault_root: Path,
    dest_public_dir: Path,
    dest_rel_stem: str,
) -> tuple[str, int, list[str]]:
    replacements: dict[str, str] = {}
    copied_names: set[str] = set()
    missing: list[str] = []

    sources: dict[str, Path] = {}
    for image in collect_sibling_images(note_dir):
        sources[image.name] = image

    def register(src_file: Path) -> str:
        copy_image(src_file, dest_public_dir)
        copied_names.add(src_file.name)
        new_url = public_url(dest_rel_stem, src_file.name)
        replacements[src_file.name] = new_url
        replacements[f"figures/{src_file.name}"] = new_url
        return new_url

    for ref in extract_image_refs(body):
        cleaned = normalize_ref(ref)
        if is_remote(cleaned):
            continue
        resolved = resolve_image(note_dir, vault_root, ref) or sources.get(Path(cleaned).name)
        if resolved is None:
            if Path(cleaned).suffix.lower() in IMAGE_EXTS:
                missing.append(cleaned)
            continue
        new_url = register(resolved)
        replacements[cleaned] = new_url
        replacements[ref.strip()] = new_url

    for image in sources.values():
        if image.name in copied_names:
            continue
        register(image)

    return rewrite_images(body, replacements), len(copied_names), missing


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("src")
    parser.add_argument("dest")
    parser.add_argument("title")
    parser.add_argument("tags")
    parser.add_argument("force")
    parser.add_argument("--vault-root", required=True)
    parser.add_argument("--public-root", required=True)
    parser.add_argument("--dest-rel-stem", required=True)
    args = parser.parse_args()

    src = Path(args.src)
    dest = Path(args.dest)
    vault_root = Path(args.vault_root)
    public_root = Path(args.public_root)
    dest_public_dir = public_root / args.dest_rel_stem

    src_text = src.read_text(encoding="utf-8")
    dest_text = dest.read_text(encoding="utf-8") if dest.exists() else ""
    body = obsidian_body(src_text)

    skip_body = False
    if dest_text:
        dest_fm, dest_body = split_closed_frontmatter(dest_text)
        dest_body_len = len(
            dest_body if dest_fm is not None and looks_like_yaml(dest_fm) else dest_text
        )
        if dest_body_len > max(len(body) * 1.5, len(body) + 2000) and args.force != "1":
            print(
                f"跳过正文（博客更长，避免覆盖）：{dest}\n"
                f"  Obsidian {len(body)} 字符 / 博客 {dest_body_len} 字符。"
                f" 若确认覆盖请 FORCE=1",
                file=sys.stderr,
            )
            skip_body = True
            body = dest_body if dest_fm is not None and looks_like_yaml(dest_fm) else dest_text

    rewritten, copied, missing = sync_images(
        body=body,
        note_dir=src.parent,
        vault_root=vault_root,
        dest_public_dir=dest_public_dir,
        dest_rel_stem=args.dest_rel_stem,
    )
    if not rewritten.endswith("\n"):
        rewritten += "\n"

    if skip_body:
        if copied or rewritten != (body if body.endswith("\n") else body + "\n"):
            fm_block = existing_frontmatter(dest_text) or default_frontmatter(args.title, args.tags)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(fm_block + rewritten, encoding="utf-8")
            print(f"已同步图片并改写路径：{dest}")
        else:
            print(f"正文已跳过，且无需同步图片：{dest}")
    else:
        fm_block = existing_frontmatter(dest_text) or default_frontmatter(args.title, args.tags)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(fm_block + rewritten, encoding="utf-8")
        print(f"已更新：{dest} ({dest.stat().st_size} bytes)")

    print(f"  图片：复制/更新 {copied} 张 → public/images/{args.dest_rel_stem}/")
    for ref in missing:
        print(f"  警告：找不到图片 {ref}", file=sys.stderr)
    return 0 if not missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
