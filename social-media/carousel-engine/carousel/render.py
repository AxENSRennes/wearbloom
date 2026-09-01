from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import textwrap

from PIL import Image, ImageDraw, ImageFont, ImageOps

from .placement import Placement, choose_placement
from .schema import Recipe


def _save_jpeg(image: Image.Image, destination: Path) -> None:
    image.save(destination, quality=95, subsampling=0)


def _wrap_copy(text: str, cover: bool) -> str:
    if "\n" in text:
        return text
    width = 18 if cover else 17
    lines = textwrap.wrap(text, width=width, break_long_words=False, break_on_hyphens=False)
    if len(lines) <= 2:
        return "\n".join(lines)
    midpoint = max(1, len(text.split()) // 2)
    words = text.split()
    return " ".join(words[:midpoint]) + "\n" + " ".join(words[midpoint:])


def _draw_text(image: Image.Image, text: str, placement: Placement, font_path: Path) -> Image.Image:
    output = image.convert("RGBA")
    overlay = Image.new("RGBA", output.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = ImageFont.truetype(str(font_path), placement.font_size)
    if placement.align == "left":
        xy = (placement.x, placement.y + placement.height / 2)
    elif placement.align == "right":
        xy = (placement.x + placement.width, placement.y + placement.height / 2)
    else:
        xy = (placement.x + placement.width / 2, placement.y + placement.height / 2)
    draw.multiline_text(
        xy,
        text,
        font=font,
        fill=placement.color,
        anchor=placement.anchor,
        align=placement.text_align,
        spacing=max(1, round(placement.font_size * 0.02)),
        stroke_width=max(1, round(placement.font_size * 0.025)),
        stroke_fill=placement.stroke + "55",
    )
    return Image.alpha_composite(output, overlay).convert("RGB")


def _instagram_canvas(image: Image.Image, placement: Placement, text: str, font_path: Path) -> Image.Image:
    canvas = Image.new("RGB", (1080, 1350), "#111111")
    fitted = ImageOps.contain(image, canvas.size, Image.Resampling.LANCZOS)
    left = (canvas.width - fitted.width) // 2
    top = (canvas.height - fitted.height) // 2
    canvas.paste(fitted, (left, top))
    sx, sy = fitted.width / image.width, fitted.height / image.height
    mapped = Placement(
        x=round(left + placement.x * sx),
        y=round(top + placement.y * sy),
        width=round(placement.width * sx),
        height=round(placement.height * sy),
        anchor=placement.anchor,
        align=placement.align,
        text_align=placement.text_align,
        color=placement.color,
        stroke=placement.stroke,
        font_size=max(22, round(placement.font_size * sx)),
        score=placement.score,
        region=placement.region,
    )
    return _draw_text(canvas, text, mapped, font_path)


def _preview(images: list[Image.Image], destination: Path) -> None:
    cell = (270, 338)
    preview = Image.new("RGB", (1080, 676), "#111111")
    for index, image in enumerate(images):
        thumb = ImageOps.fit(image, cell, Image.Resampling.LANCZOS)
        preview.paste(thumb, ((index % 4) * cell[0], (index // 4) * cell[1]))
    preview.save(destination, quality=94, subsampling=0)


def render_recipe(recipe: Recipe, output_dir: Path) -> Path:
    original_dir = output_dir / "tiktok-original"
    instagram_dir = output_dir / "instagram-4x5"
    original_dir.mkdir(parents=True, exist_ok=True)
    instagram_dir.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []
    preview_images: list[Image.Image] = []
    previous: list[tuple[float, float]] = []
    previous_colors: list[str] = []

    save_futures = []
    with ThreadPoolExecutor(max_workers=4) as save_pool:
        for index, slide in enumerate(recipe.slides, start=1):
            source = recipe.dataset / slide.source
            image = ImageOps.exif_transpose(Image.open(source)).convert("RGB")
            display_text = _wrap_copy(slide.text, slide.cover)
            placement = choose_placement(
                image,
                display_text,
                str(recipe.font),
                recipe.seed,
                slide.source,
                previous,
                previous_colors,
                recipe.text_align,
                slide.cover,
            )
            rendered = _draw_text(image, display_text, placement, recipe.font)
            filename = f"{index:02d}.jpg"
            save_futures.append(save_pool.submit(_save_jpeg, rendered, original_dir / filename))
            instagram = _instagram_canvas(image, placement, display_text, recipe.font)
            save_futures.append(save_pool.submit(_save_jpeg, instagram, instagram_dir / filename))
            preview_images.append(instagram)
            center_x = (placement.x + placement.width / 2) / image.width
            center_y = (placement.y + placement.height / 2) / image.height
            previous.append((center_x, center_y))
            previous_colors.append(placement.color)
            manifest.append({
                "slide": index,
                "source": slide.source,
                "text": slide.text,
                "display_text": display_text,
                "font_size": placement.font_size,
                "position": {"x": round(center_x, 4), "y": round(center_y, 4), "region": placement.region},
                "align": placement.align,
                "text_align": placement.text_align,
                "color": placement.color,
                "score": round(placement.score, 4),
            })
        for future in save_futures:
            future.result()

    preview_path = output_dir / "preview-adaptive.jpg"
    _preview(preview_images, preview_path)
    (output_dir / "manifest.json").write_text(json.dumps({"id": recipe.id, "seed": recipe.seed, "slides": manifest}, indent=2) + "\n")
    (output_dir / "caption.txt").write_text(recipe.caption.rstrip() + "\n")
    return preview_path
