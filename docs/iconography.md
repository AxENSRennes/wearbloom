# WearBloom iconography

Closet category icons use the **IconPark Outline** family by ByteDance. Keep
new category icons in this family so the 48×48 grid, 4-point stroke, rounded
line caps, and monochrome rendering remain consistent.

## Current mapping

| WearBloom category | IconPark source icon | Asset name |
| --- | --- | --- |
| Top | `t-shirt` | `category-top` |
| Bottom | `clothes-pants` | `category-bottom` |
| Dress | `full-dress-longuette` | `category-dress` |
| Outerwear | `women-coat` | `category-outerwear` |

The SVGs are template-rendered by the asset catalog and displayed at 17×17
points, directly over the top-left of closet card images with no badge or
background. Add future category assets to the `CategoryIcons` asset group and
map them through `GarmentCategory.closetCardIconAsset`.

## Future categories available in the same pack

- Footwear: `boots`, `high-heeled-shoes`, `sandals`, `slippers`, `spikedshoes`
- Bags: `handbag`
- Headwear: `hat`, `sun-hat`, `woolen-hat`
- Eyewear: `glasses`, `glasses-one`, `glasses-three`
- Jewelry: `diamond-necklace`

IconPark does not currently provide a strong generic sneaker outline. Do not
mix in an unrelated icon family for a single category; either use the closest
IconPark footwear symbol or draw the missing symbol on the same 48×48 grid and
4-point stroke.

Source: https://github.com/bytedance/IconPark

License: Apache License 2.0
