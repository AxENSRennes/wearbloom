# WearBloom adaptive carousel engine

Independent Python renderer for photo carousels. It analyses local texture and contrast, scores valid text regions, then makes a seeded weighted selection among the best candidates. The same recipe and seed reproduce the same output.

```bash
python3 -m venv .venv
.venv/bin/pip install -e .
.venv/bin/wearbloom-carousel
```

Outputs include the uncropped TikTok originals, 1080 × 1350 Instagram variants, a preview, caption and placement manifest.
