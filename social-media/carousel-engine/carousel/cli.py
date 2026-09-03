import argparse
import json
from pathlib import Path

from .copy import generate_copy
from .render import render_recipe
from .schema import ResolvedRecipe, SourceRecipe


def _load_payload(path: Path) -> dict:
    payload = json.loads(path.read_text())
    for field in ("dataset", "font"):
        value = Path(payload[field])
        payload[field] = value if value.is_absolute() else (path.parent / value).resolve()
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and render WearBloom photo carousels")
    commands = parser.add_subparsers(dest="command", required=True)

    generate = commands.add_parser("generate", help="Generate copy with Luna and render the carousel")
    generate.add_argument("--recipe", type=Path, required=True)
    generate.add_argument("--output", type=Path, required=True)
    generate.add_argument("--model", default="gpt-5.6-luna")
    generate.add_argument(
        "--reasoning-effort",
        choices=("none", "low", "medium", "high", "xhigh", "max"),
        default="low",
    )

    render = commands.add_parser("render", help="Render an existing resolved recipe without calling Luna")
    render.add_argument("--recipe", type=Path, required=True)
    render.add_argument("--output", type=Path, required=True)

    args = parser.parse_args()
    recipe_path = args.recipe.resolve()
    output_dir = args.output.resolve()

    if args.command == "generate":
        source = SourceRecipe.model_validate(_load_payload(recipe_path))
        recipe = generate_copy(
            source,
            model=args.model,
            reasoning_effort=args.reasoning_effort,
        )
        output_dir.mkdir(parents=True, exist_ok=True)
        resolved_path = output_dir / "resolved-recipe.json"
        resolved_path.write_text(json.dumps(recipe.model_dump(mode="json"), indent=2) + "\n")
        print(resolved_path)
    else:
        recipe = ResolvedRecipe.model_validate(_load_payload(recipe_path))

    print(render_recipe(recipe, output_dir))


if __name__ == "__main__":
    main()
