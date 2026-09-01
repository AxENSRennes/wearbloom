from __future__ import annotations

import base64
import mimetypes
from pathlib import Path

from openai import OpenAI

from .schema import GeneratedCopy, Recipe


EDITORIAL_INSTRUCTIONS = """You write short English copy for WearBloom fashion photo carousels.

Write exactly one text for each image, in the supplied order, followed by one caption.

Slide rules:
- 2 to 7 words and no more than 48 characters
- natural TikTok fashion language
- lowercase unless emphasis is intentional
- react to something genuinely visible in the corresponding image
- vary sentence structure and vocabulary across the carousel
- slide 1 is a clear cover hook
- never invent brands, prices, materials, product sources, or personal facts

Caption rules:
- one short hook and one natural question
- 3 to 5 relevant hashtags
- no unsupported claims
"""


def _image_data_url(path: Path) -> str:
    media_type = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{media_type};base64,{encoded}"


def generate_copy(
    recipe: Recipe,
    brief: str,
    *,
    model: str = "gpt-5.6-luna",
    reasoning_effort: str = "low",
    client: OpenAI | None = None,
) -> Recipe:
    content: list[dict[str, str]] = [{
        "type": "input_text",
        "text": f"Creative brief: {brief.strip() or 'Create a cohesive fashion carousel.'}",
    }]
    for index, slide in enumerate(recipe.slides, start=1):
        source = recipe.dataset / slide.source
        content.extend([
            {"type": "input_text", "text": f"Slide {index}{' — cover' if slide.cover else ''}"},
            {"type": "input_image", "image_url": _image_data_url(source), "detail": "low"},
        ])

    api = client or OpenAI()
    response = api.responses.parse(
        model=model,
        reasoning={"effort": reasoning_effort},
        instructions=EDITORIAL_INSTRUCTIONS,
        input=[{"role": "user", "content": content}],
        text_format=GeneratedCopy,
        store=False,
    )
    generated = response.output_parsed
    if generated is None:
        raise RuntimeError("Luna returned no structured copy")

    slides = [
        slide.model_copy(update={"text": generated_slide.text})
        for slide, generated_slide in zip(recipe.slides, generated.slides, strict=True)
    ]
    return recipe.model_copy(update={"slides": slides, "caption": generated.caption})
