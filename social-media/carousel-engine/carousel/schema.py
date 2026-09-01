from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class Slide(BaseModel):
    source: str
    text: str = Field(min_length=2, max_length=48)
    cover: bool = False

    @field_validator("text")
    @classmethod
    def keep_copy_short(cls, value: str) -> str:
        if len(value.split()) > 7:
            raise ValueError("slide copy must contain at most seven words")
        return value.strip()


class Recipe(BaseModel):
    id: str
    seed: int = 20260901
    dataset: Path
    font: Path
    text_align: Literal["left", "center", "right"] = "center"
    slides: list[Slide] = Field(min_length=8, max_length=8)
    caption: str
