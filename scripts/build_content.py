#!/usr/bin/env python3
"""Build a compact content payload from the lossless WordPress archive."""

from __future__ import annotations

import json
import re
import urllib.parse
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
ARCHIVE = PROJECT.parent / "content-export"
OUT = PROJECT / "src/data/site-content.json"
PAGE_OUT = PROJECT / "public/content"
CUSTOM_CONTENT = PROJECT / "content/arizona-district-watch.json"
DISTRICT_HUB_ROUTES = {
    "/district-watch/arizona-schools/",
    "/district-watch/georgia-schools/",
    "/district-watch/michigan-schools/",
    "/district-watch/north-carolina-schools/",
    "/district-watch/virginia-schools/",
    "/district-watch/wisconsin-schools/",
}


def merge_custom_pages(pages: list[dict]) -> list[dict]:
    if not CUSTOM_CONTENT.exists():
        return pages
    custom_pages = json.loads(CUSTOM_CONTENT.read_text()).get("pages", [])
    custom_ids = {entry["id"] for entry in custom_pages}
    custom_routes = {entry["route"] for entry in custom_pages}
    merged = [entry for entry in pages if entry["id"] not in custom_ids and entry["route"] not in custom_routes]
    PAGE_OUT.mkdir(parents=True, exist_ok=True)
    for entry in custom_pages:
        (PAGE_OUT / f"{entry['id']}.json").write_text(json.dumps(entry, ensure_ascii=False))
        merged.append({key: value for key, value in entry.items() if key != "body"})
    return merged


def frontmatter_from_markdown(path: Path) -> dict[str, str]:
    text = path.read_text(errors="replace")
    if not text.startswith("---"):
        return {}
    parts = text.split("---", 2)
    if len(parts) != 3:
        return {}
    metadata = {}
    for line in parts[1].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        value = value.strip()
        if value.startswith('"') and value.endswith('"'):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                value = value[1:-1]
        metadata[key.strip()] = value
    return metadata


def body_from_markdown(path: Path) -> str:
    text = path.read_text(errors="replace")
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) == 3:
            text = parts[2]
    text = text.replace("\u2014", " - ").replace("\u2013", "-")
    text = re.sub(r"^(#{1,6}\s+)\*\*([^\n]*?)\n\*\*\s*$", r"\1\2", text, flags=re.MULTILINE)
    text = re.sub(r"\*\*(\[[^\n]+?\]\([^)]+\)):\s*\*\*", r"**\1:** ", text)
    text = re.sub(r"^\[\]\([^)]+\)\s*$\n?", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\[\s*$\n?", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\]\(https?://[^)]+\)\s*$\n?", "", text, flags=re.MULTILINE)
    text = re.sub(r"^- \* (.+)\*\s*$", r"- *\1*", text, flags=re.MULTILINE)
    text = re.sub(r"^\*\*\*(\d+\.\s+)(.+)\*\s*$", r"\1*\2*", text, flags=re.MULTILINE)
    text = re.sub(r"^-\s*$\n?", "", text, flags=re.MULTILINE)
    return text.strip()


def visible_text(value: str) -> str:
    return (value or "").replace("\u2014", " - ").replace("\u2013", "-")


def localize_url(url: str, external_map: dict[str, str]) -> str:
    url = url.rstrip(".,;\u201d\u2019")
    parsed = urllib.parse.urlparse(url)
    marker = "/wp-content/uploads/"
    if parsed.netloc.lower() in {"restoringedu.com", "www.restoringedu.com"} and marker in parsed.path:
        return "/media/uploads/" + urllib.parse.unquote(parsed.path.split(marker, 1)[1])
    if url in external_map:
        local = external_map[url]
        return "/media/" + local.split("assets/", 1)[-1]
    return url


def localize_markdown(text: str, external_map: dict[str, str]) -> str:
    pattern = re.compile(r"https?://[^\s\)\]\"'<>]+")
    return pattern.sub(lambda match: localize_url(match.group(0), external_map), text)


def route(url: str) -> str:
    path = urllib.parse.urlparse(url).path
    return path if path.endswith("/") else path + "/"


def page_kind(item: dict, child_count: int, district_hub_ids: set[int]) -> str:
    path = route(item["source_url"])
    title = item["title"].lower()
    if path == "/":
        return "home"
    if path == "/news/":
        return "news"
    if path == "/grading-system/":
        return "grading"
    if path == "/district-watch/":
        return "district-watch"
    if path in DISTRICT_HUB_ROUTES:
        return "directory"
    if item["type"] == "post":
        return "post"
    if not item["parent_wordpress_id"]:
        return "state"
    if "polic" in title:
        return "policy"
    if item["parent_wordpress_id"] in district_hub_ids:
        return "directory"
    if child_count:
        return "directory"
    return "profile"


def main():
    manifest_path = ARCHIVE / "site-manifest.json"
    media_catalog_path = ARCHIVE / "media-ready/catalog.json"

    # The original WordPress export is kept outside this deployable project.
    # Cloud builds should use the generated content already committed to the
    # repository instead of failing because that source archive is unavailable.
    if not manifest_path.exists() or not media_catalog_path.exists():
        generated_pages = list(PAGE_OUT.glob("*.json")) if PAGE_OUT.exists() else []
        if OUT.exists() and generated_pages:
            payload = json.loads(OUT.read_text())
            payload["pages"] = merge_custom_pages(payload.get("pages", []))
            OUT.write_text(json.dumps(payload, ensure_ascii=False))
            print(
                "Source content archive is unavailable; "
                f"using committed content payload with {len(payload['pages'])} pages"
            )
            return
        raise FileNotFoundError(
            "The source content archive and committed generated content are both missing."
        )

    manifest = json.loads(manifest_path.read_text())
    media_catalog = json.loads(media_catalog_path.read_text())
    external_map = {
        record["source_url"]: record["local_file"]
        for record in media_catalog
        if not record.get("wordpress_id") and record.get("local_file")
    }
    children: dict[int, list[int]] = {}
    for item in manifest["items"]:
        children.setdefault(item["parent_wordpress_id"], []).append(item["wordpress_id"])
    district_hub_ids = {
        item["wordpress_id"]
        for item in manifest["items"]
        if route(item["source_url"]) in DISTRICT_HUB_ROUTES
    }

    pages = []
    PAGE_OUT.mkdir(parents=True, exist_ok=True)
    for item in manifest["items"]:
        markdown_path = ARCHIVE / item["content_file"]
        metadata = frontmatter_from_markdown(markdown_path)
        md = body_from_markdown(markdown_path)
        md = localize_markdown(md, external_map)
        grade_match = re.search(r"CURRENT GRADE:\s*([A-F][+-]?)", md, re.I)
        images = []
        for image in item.get("images", []):
            localized = localize_url(image["url"], external_map)
            if localized not in [entry["src"] for entry in images]:
                images.append({
                    "src": localized,
                    "alt": visible_text(image.get("alt") or item["title"]),
                })
        page = {
            "id": item["wordpress_id"],
            "title": visible_text(item["title"]),
            "slug": item["slug"],
            "route": route(item["source_url"]),
            "sourceUrl": item["source_url"],
            "parentId": item["parent_wordpress_id"],
            "childIds": children.get(item["wordpress_id"], []),
            "kind": page_kind(item, len(children.get(item["wordpress_id"], [])), district_hub_ids),
            "grade": grade_match.group(1).upper() if grade_match else None,
            "description": visible_text(item.get("seo", {}).get("description") or ""),
            "body": md,
            "images": images,
            "modified": item.get("modified"),
        }
        if metadata.get("profile_status"):
            page["profileStatus"] = visible_text(metadata["profile_status"])
        if metadata.get("profile_status_detail"):
            page["profileStatusDetail"] = visible_text(metadata["profile_status_detail"])
        (PAGE_OUT / f"{item['wordpress_id']}.json").write_text(json.dumps(page, ensure_ascii=False))
        pages.append({key: value for key, value in page.items() if key != "body"})

    pages = merge_custom_pages(pages)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"generatedFrom": str(ARCHIVE), "pages": pages}, ensure_ascii=False))
    print(f"Generated {OUT} with {len(pages)} routes")


if __name__ == "__main__":
    main()
