import argparse
import json
from pathlib import Path

from .copy import generate_copy
from .render import render_recipe
from .schema import Recipe


def main() -> None:
    parser = argparse.ArgumentParser(description="Render an adaptive WearBloom photo carousel")
    parser.add_argument("--recipe", type=Path, default=Path("recipes/back-to-school-001.json"))
    parser.add_argument("--output", type=Path, default=Path("output/back-to-school-001"))
    parser.add_argument("--generate-copy", action="store_true", help="Generate slide copy and caption with Luna")
    parser.add_argument("--brief", default="cohesive fashion outfit inspiration")
    parser.add_argument("--model", default="gpt-5.6-luna")
    parser.add_argument("--reasoning-effort", choices=("none", "low", "medium", "high", "xhigh", "max"), default="low")
    args = parser.parse_args()
    recipe_path = args.recipe.resolve()
    payload = json.loads(recipe_path.read_text())
    for field in ("dataset", "font"):
        path = Path(payload[field])
        payload[field] = path if path.is_absolute() else (recipe_path.parent / path).resolve()
    recipe = Recipe.model_validate(payload)
    output_dir = args.output.resolve()
    if args.generate_copy:
        recipe = generate_copy(
            recipe,
            args.brief,
            model=args.model,
            reasoning_effort=args.reasoning_effort,
        )
        output_dir.mkdir(parents=True, exist_ok=True)
        resolved = output_dir / "resolved-recipe.json"
        resolved.write_text(json.dumps(recipe.model_dump(mode="json"), indent=2) + "\n")
        print(resolved)
    print(render_recipe(recipe, output_dir))


if __name__ == "__main__":
    main()
