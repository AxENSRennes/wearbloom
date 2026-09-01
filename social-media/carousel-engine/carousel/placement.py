from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from hashlib import blake2b
import colorsys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


HUMAN_SEGMENTATION_MODEL = Path(__file__).parent / "models" / "human_segmentation_pphumanseg_2023mar.onnx"


@dataclass(frozen=True)
class Placement:
    x: int
    y: int
    width: int
    height: int
    anchor: str
    align: str
    text_align: str
    color: str
    stroke: str
    font_size: int
    score: float
    region: str


def _normalise(values: np.ndarray) -> np.ndarray:
    low, high = np.percentile(values, (5, 95))
    return np.clip((values - low) / max(high - low, 1e-6), 0, 1)


def visual_complexity(image: Image.Image, analysis_width: int = 420) -> np.ndarray:
    ratio = analysis_width / image.width
    height = max(1, round(image.height * ratio))
    rgb = np.asarray(image.resize((analysis_width, height), Image.Resampling.LANCZOS).convert("RGB"))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    edges = cv2.GaussianBlur(cv2.magnitude(grad_x, grad_y), (0, 0), 2.2)
    mean = cv2.GaussianBlur(gray, (0, 0), 7)
    mean_sq = cv2.GaussianBlur(gray * gray, (0, 0), 7)
    local_std = np.sqrt(np.maximum(mean_sq - mean * mean, 0))
    return 0.68 * _normalise(edges) + 0.32 * _normalise(local_std)


@lru_cache(maxsize=1)
def _human_segmentation_net() -> cv2.dnn.Net:
    return cv2.dnn.readNet(str(HUMAN_SEGMENTATION_MODEL))


def human_subject_mask(image: Image.Image, width: int, height: int) -> np.ndarray | None:
    """Return a cheap, deliberately padded person mask at analysis resolution."""
    if not HUMAN_SEGMENTATION_MODEL.exists():
        return None
    try:
        sample = np.asarray(image.resize((192, 192), Image.Resampling.BILINEAR).convert("RGB"))
        bgr = cv2.cvtColor(sample, cv2.COLOR_RGB2BGR).astype(np.float32) / 255.0
        blob = cv2.dnn.blobFromImage((bgr - 0.5) / 0.5)
        net = _human_segmentation_net()
        net.setInput(blob)
        prediction = net.forward("save_infer_model/scale_0.tmp_1")[0]
        mask = np.argmax(prediction, axis=0).astype(np.uint8)
        mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_NEAREST)
        # Keep text off the silhouette edges, hair and clothing outlines too.
        radius = max(3, round(min(width, height) * 0.025))
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius * 2 + 1, radius * 2 + 1))
        return cv2.dilate(mask, kernel)
    except cv2.error:
        return None


def _relative_luminance(hex_color: str) -> float:
    values = [int(hex_color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in values]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def _contrast(a: float, b: float) -> float:
    bright, dark = max(a, b), min(a, b)
    return (bright + 0.05) / (dark + 0.05)


def _luminance_map(rgb: np.ndarray) -> np.ndarray:
    values = rgb.astype(np.float32) / 255.0
    linear = np.where(values <= 0.04045, values / 12.92, ((values + 0.055) / 1.055) ** 2.4)
    return 0.2126 * linear[..., 0] + 0.7152 * linear[..., 1] + 0.0722 * linear[..., 2]


def _integral(values: np.ndarray) -> np.ndarray:
    return cv2.integral(values.astype(np.float64))


def _rect_sum(integral: np.ndarray, x0: int, y0: int, x1: int, y1: int) -> float:
    return float(integral[y1, x1] - integral[y0, x1] - integral[y1, x0] + integral[y0, x0])


def _image_palette(image: Image.Image, count: int = 18) -> list[str]:
    sample = image.copy()
    sample.thumbnail((240, 240), Image.Resampling.LANCZOS)
    quantized = sample.convert("RGB").quantize(colors=12, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette()
    ranked = sorted(quantized.getcolors() or [], reverse=True)
    accents: list[tuple[float, str]] = []
    for frequency, index in ranked:
        red, green, blue = palette[index * 3:index * 3 + 3]
        hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
        saturation = min(0.92, max(0.62, saturation * 1.28))
        value = min(0.96, max(0.70, value * 1.12))
        # Original, analogous and complementary hues all remain related to the
        # source image while preventing every slide from collapsing into brown.
        for offset, relation_weight in ((0.0, 1.0), (-0.09, 0.82), (0.09, 0.82), (0.50, 0.76)):
            related_hue = (hue + offset) % 1.0
            out = colorsys.hsv_to_rgb(related_hue, saturation, value)
            color = "#" + "".join(f"{round(channel * 255):02X}" for channel in out)
            score = frequency * relation_weight * (0.55 + saturation)
            if color not in {item[1] for item in accents}:
                accents.append((score, color))
    return [color for _, color in sorted(accents, reverse=True)[:count]] or ["#FF6B6B"]


def _select_slide_color(palette: list[str], previous: list[str]) -> str:
    if not previous:
        return palette[0]

    previous_hues = [colorsys.rgb_to_hsv(*(int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)))[0] for color in previous]

    def score(color: str) -> float:
        rgb = tuple(int(color[index:index + 2], 16) / 255 for index in (1, 3, 5))
        hue, saturation, value = colorsys.rgb_to_hsv(*rgb)
        hue_distance = min(min(abs(hue - old), 1 - abs(hue - old)) for old in previous_hues)
        return 2.4 * hue_distance + 0.55 * saturation + 0.20 * value

    return max(palette, key=score)


def _measure(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, align: str, spacing: int) -> tuple[int, int]:
    box = draw.multiline_textbbox((0, 0), text, font=font, spacing=spacing, align=align, stroke_width=1)
    return box[2] - box[0], box[3] - box[1]


def _stable_rng(seed: int, source: str) -> np.random.Generator:
    digest = blake2b(f"{seed}:{source}".encode(), digest_size=8).digest()
    return np.random.default_rng(int.from_bytes(digest, "big"))


def choose_placement(
    image: Image.Image,
    text: str,
    font_path: str,
    seed: int,
    source: str,
    previous: list[tuple[float, float]],
    previous_colors: list[str],
    text_align: str,
    cover: bool,
) -> Placement:
    rng = _stable_rng(seed, source)
    word_count = max(1, len(text.replace("\n", " ").split()))
    if cover:
        size_ratio = rng.uniform(0.055, 0.068)
        size_cap = 76
    else:
        length_factor = np.interp(word_count, [2, 7], [1.0, 0.72])
        size_ratio = rng.uniform(0.043, 0.063) * length_factor
        size_cap = 72
    font_size = max(32, min(round(image.width * size_ratio), size_cap))
    font = ImageFont.truetype(font_path, font_size)
    draw = ImageDraw.Draw(image)
    spacing = max(1, round(font_size * 0.02))
    complexity = visual_complexity(image)
    human_mask = human_subject_mask(image, complexity.shape[1], complexity.shape[0])
    image_palette = _image_palette(image)
    # Pick the image-derived colour once. Placement must adapt to the colour,
    # never the other way around.
    color = _select_slide_color(image_palette, previous_colors)
    color_luminance = _relative_luminance(color)
    scale_x = complexity.shape[1] / image.width
    scale_y = complexity.shape[0] / image.height
    analysis_rgb = np.asarray(
        image.resize(complexity.shape[::-1], Image.Resampling.BILINEAR).convert("RGB")
    )
    analysis_lab = cv2.cvtColor(analysis_rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    analysis_luminance = _luminance_map(analysis_rgb)
    complexity_integral = _integral(complexity)
    human_integral = _integral(human_mask) if human_mask is not None else None
    lab_integrals = [_integral(analysis_lab[..., channel]) for channel in range(3)]
    lab_square_integrals = [_integral(analysis_lab[..., channel] ** 2) for channel in range(3)]
    text_width, text_height = _measure(draw, text, font, text_align, spacing)
    safe_left, safe_right = 0.06, 0.94
    safe_top, safe_bottom = 0.10, 0.80
    xs = np.linspace(0.08, 0.92, 15)
    ys = np.linspace(0.13, 0.79, 12)
    candidates: list[Placement] = []

    for nx in xs:
        for ny in ys:
            align = "left" if nx < 0.42 else "right" if nx > 0.58 else "center"
            anchor = "lm" if align == "left" else "rm" if align == "right" else "mm"
            padding = max(5, round(font_size * 0.10))
            if align == "left":
                left = round(nx * image.width)
            elif align == "right":
                left = round(nx * image.width - text_width)
            else:
                left = round(nx * image.width - text_width / 2)
            top = round(ny * image.height - text_height / 2)
            right, bottom = left + text_width, top + text_height
            if left < safe_left * image.width or right > safe_right * image.width:
                continue
            if top < safe_top * image.height or bottom > safe_bottom * image.height:
                continue

            ax0 = max(0, round((left - padding) * scale_x))
            ay0 = max(0, round((top - padding) * scale_y))
            ax1 = min(complexity.shape[1], round((right + padding) * scale_x))
            ay1 = min(complexity.shape[0], round((bottom + padding) * scale_y))
            area = max(1, (ax1 - ax0) * (ay1 - ay0))
            quietness = 1.0 - _rect_sum(complexity_integral, ax0, ay0, ax1, ay1) / area

            if human_mask is not None:
                subject_overlap = _rect_sum(human_integral, ax0, ay0, ax1, ay1) / area
            else:
                grid_y, grid_x = np.mgrid[ay0:ay1, ax0:ax1]
                norm_x = grid_x / max(complexity.shape[1] - 1, 1)
                norm_y = grid_y / max(complexity.shape[0] - 1, 1)
                central_body = (norm_x >= 0.33) & (norm_x <= 0.67) & (norm_y >= 0.07) & (norm_y <= 0.91)
                subject_ellipse = (((norm_x - 0.50) / 0.24) ** 2 + ((norm_y - 0.48) / 0.48) ** 2) <= 1
                subject_prior = central_body | subject_ellipse
                subject_overlap = float(np.mean(subject_prior))

            channel_stds = []
            for lab_integral, square_integral in zip(lab_integrals, lab_square_integrals, strict=True):
                channel_mean = _rect_sum(lab_integral, ax0, ay0, ax1, ay1) / area
                channel_mean_square = _rect_sum(square_integral, ax0, ay0, ax1, ay1) / area
                channel_stds.append(np.sqrt(max(channel_mean_square - channel_mean**2, 0.0)))
            colour_variation = float(np.mean(channel_stds))
            uniformity = float(np.clip(1.0 - colour_variation / 42.0, 0.0, 1.0))
            luminances = analysis_luminance[ay0:ay1, ax0:ax1]
            pixel_contrasts = (np.maximum(color_luminance, luminances) + 0.05) / (np.minimum(color_luminance, luminances) + 0.05)
            # The lower percentile catches patches where a few letters would
            # disappear even though the area's average contrast looks fine.
            robust_contrast = float(np.percentile(pixel_contrasts, 20))
            median_luminance = float(np.median(luminances))
            contrast_score = min(robust_contrast / 4.5, 1.0)
            stroke = "#111111" if median_luminance > color_luminance else "#FFFFFF"
            edge_clearance = min(nx - safe_left, safe_right - nx, ny - safe_top, safe_bottom - ny) / 0.25
            nearest_previous = 1.0 if not previous else min(np.hypot(nx - px, ny - py) for px, py in previous)
            diversity = min(nearest_previous / 0.38, 1.0)
            reuse_penalty = 0.34 if previous and nearest_previous < 0.18 else 0.0
            score = 0.22 * quietness + 0.24 * uniformity + 0.48 * contrast_score + 0.04 * min(edge_clearance, 1.0) + 0.08 * diversity - 0.42 * subject_overlap - 0.34 * reuse_penalty
            candidate = Placement(left, top, text_width, text_height, anchor, align, text_align, color, stroke, font_size, score, f"{nx:.2f},{ny:.2f}")
            candidates.append(candidate)

    if not candidates:
        raise RuntimeError(f"no valid text placement for {source}")
    return max(candidates, key=lambda item: item.score)
