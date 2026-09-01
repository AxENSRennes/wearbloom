from __future__ import annotations

import base64
import mimetypes
from pathlib import Path

from openai import OpenAI

from .schema import GeneratedCopy, Recipe


EDITORIAL_INSTRUCTIONS = """Write overlay copy for a casual fashion TikTok carousel.

The voice is a real fashion-obsessed person reacting to each photo, not a brand,
copywriter, stylist, catalogue, or trend report. It should feel spontaneous,
specific, slightly imperfect, and effortless.

Write exactly one text for each image in the supplied order, then one caption.

Slide 1 is the carousel cover:
- write a clear theme title based on the brief, such as "back to school outfits"
- describe the carousel topic, not the outfit visible in the first image
- keep it simple and immediately understandable

Slides 2 to 8 react to their corresponding images.

For slides 2 to 8, naturally mix these modes instead of repeating one formula:
- a plain item label: "bermuda shorts", "long coat", "satin set"
- a quick personal reaction: "just love it", "the jacket is INSANE"
- a visible styling detail: "matching bag + sneakers"
- a casual opinion or vibe: "grey is class no debate", "old money vibes"
- a slightly excited observation: "the jacket is just wow and the bag omg"

These examples define the tone only. Do not mechanically copy them when they do
not match the image.

Slide rules:
- 2 to 10 words and no more than 64 characters
- mostly lowercase; occasional uppercase emphasis is welcome
- simple everyday vocabulary and natural internet phrasing
- mention a genuinely visible garment, accessory, colour, proportion, or vibe
- vary length: some slides can be only 2 or 3 words
- emojis are optional and rare
- avoid polished marketing language such as "ready", "energy", "unlocked",
  "remix", "elevated", "effortless", "statement", "must-have", or "chic edit"
- do not turn every line into a complete grammatical sentence
- never invent brands, prices, materials, product sources, or personal facts

Caption rules:
- very minimal, like "inspos" or a short lowercase phrase
- 4 to 6 relevant fashion hashtags
- no marketing call to action and no forced question
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
