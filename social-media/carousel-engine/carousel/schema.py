from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_short_copy(value: str) -> str:
    value = value.strip()
    if len(value.split()) > 10:
        raise ValueError("slide copy must contain at most ten words")
    return value


class SourceSlide(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str
    cover: bool = False


class GeneratedSlideCopy(BaseModel):
    text: str = Field(min_length=2, max_length=64)

    @field_validator("text")
    @classmethod
    def keep_copy_short(cls, value: str) -> str:
        return _validate_short_copy(value)


class GeneratedCopy(BaseModel):
    slides: list[GeneratedSlideCopy] = Field(min_length=8, max_length=8)
    caption: str = Field(min_length=10, max_length=500)


class SourceRecipe(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    seed: int = 20260901
    dataset: Path
    font: Path
    text_align: Literal["left", "center", "right"] = "center"
    brief: str = Field(min_length=3)
    slides: list[SourceSlide] = Field(min_length=8, max_length=8)


class ResolvedSlide(SourceSlide):
    text: str = Field(min_length=2, max_length=64)

    @field_validator("text")
    @classmethod
    def keep_copy_short(cls, value: str) -> str:
        return _validate_short_copy(value)


class ResolvedRecipe(BaseModel):
    id: str
    seed: int
    dataset: Path
    font: Path
    text_align: Literal["left", "center", "right"]
    slides: list[ResolvedSlide] = Field(min_length=8, max_length=8)
    caption: str
