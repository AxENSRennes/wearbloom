import argparse
import json
from pathlib import Path

from .render import render_recipe
from .schema import Recipe


def main() -> None:
    parser = argparse.ArgumentParser(description="Render an adaptive WearBloom photo carousel")
    parser.add_argument("--recipe", type=Path, default=Path("recipes/back-to-school-001.json"))
    parser.add_argument("--output", type=Path, default=Path("output/back-to-school-001"))
    args = parser.parse_args()
    recipe_path = args.recipe.resolve()
    payload = json.loads(recipe_path.read_text())
    for field in ("dataset", "font"):
        path = Path(payload[field])
        payload[field] = path if path.is_absolute() else (recipe_path.parent / path).resolve()
    recipe = Recipe.model_validate(payload)
    print(render_recipe(recipe, args.output.resolve()))


if __name__ == "__main__":
    main()
