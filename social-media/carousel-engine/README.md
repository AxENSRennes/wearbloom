# WearBloom adaptive carousel engine

Independent Python renderer for photo carousels. It analyses local texture and contrast, scores valid text regions, then makes a seeded weighted selection among the best candidates. The same recipe and seed reproduce the same output.

```bash
python3 -m venv .venv
.venv/bin/pip install -e .
.venv/bin/wearbloom-carousel
```

Outputs include the uncropped TikTok originals, 1080 × 1350 Instagram variants, a preview, caption and placement manifest.

## Generate the copy with Luna

Set `OPENAI_API_KEY` in the environment, then run one Luna request for the eight images before rendering:

```bash
.venv/bin/wearbloom-carousel \
  --generate-copy \
  --brief "back-to-school outfits, casual and editorial"
```

The command uses `gpt-5.6-luna` with Structured Outputs, validates the result with Pydantic, saves `resolved-recipe.json` in the output directory, and renders it through the normal deterministic pipeline. Use `--model` or `--reasoning-effort` to override the defaults.

The editorial voice intentionally follows casual TikTok fashion commentary: short item labels, visible styling details, spontaneous reactions, and simple opinions rather than polished brand copy.

Text placement uses OpenCV's lightweight PP-HumanSeg ONNX model at 192×192 to keep copy off people and clothing. It then ranks the remaining negative space by texture and contrast while preserving the selected text colour. The bundled model comes from the OpenCV Model Zoo and is licensed under Apache-2.0; attribution and its checksum are recorded in `carousel/models/README.md`.
