const A = {
  tee: "cream-ribbed-tee",
  cardigan: "butter-cardigan",
  layer: "cobalt-overshirt",
  trousers: "chocolate-wide-trousers",
  skirt: "burgundy-satin-skirt",
  dress: "black-slip-dress",
  sneaker: "white-sneaker",
  loafer: "black-loafer",
  heel: "red-heel"
};

const slide = (title, layout, groups, extra = {}) => ({ title, layout, groups, ...extra });
const group = (label, assets, note = "", extra = {}) => ({ label, assets, note, ...extra });

function post(slug, name, hook, caption, slides) {
  return { slug, series: name, hook, caption, slides };
}

export const series = [
  {
    slug: "colors-with-brown",
    name: "COLOR PAIRINGS",
    make: () => post(
      "colors-with-brown",
      "COLOR PAIRINGS",
      "3 COLORS THAT MAKE BROWN LOOK EXPENSIVE",
      "Brown is easier to style than black once you know these three pairings. Which one would you wear first: cream, cobalt or butter yellow? Save this for the next time your brown trousers feel boring.",
      [
        slide("3 COLORS THAT MAKE BROWN LOOK EXPENSIVE", "hero", [group("START WITH BROWN", [A.trousers, A.tee, A.layer, A.cardigan])], { subtitle: "Cream. Cobalt. Butter yellow." }),
        slide("01 / ADD CREAM", "split", [group("WHY IT WORKS", [A.trousers, A.tee], "Low contrast makes brown feel softer and more intentional.", { chips: ["#5B3425", "#EFE4D2"] })]),
        slide("02 / ADD COBALT", "split", [group("WHY IT WORKS", [A.trousers, A.layer], "A saturated cool tone gives warm brown a sharper edge.", { chips: ["#5B3425", "#174CCF"] })]),
        slide("03 / ADD BUTTER", "split", [group("WHY IT WORKS", [A.trousers, A.cardigan], "Two warm shades feel rich without becoming too matchy.", { chips: ["#5B3425", "#F1D66A"] })]),
        slide("THE QUICK RULE", "rows", [
          group("SOFT", [A.tee], "Choose cream"),
          group("BOLD", [A.layer], "Choose cobalt"),
          group("WARM", [A.cardigan], "Choose butter")
        ], { subtitle: "Save this brown-color cheat sheet." })
      ]
    )
  },
  {
    slug: "wide-leg-formulas",
    name: "OUTFIT FORMULAS",
    make: () => post(
      "wide-leg-formulas",
      "OUTFIT FORMULAS",
      "IF YOU OWN WIDE-LEG TROUSERS, COPY THESE 4 FORMULAS",
      "One pair of wide-leg trousers, four formulas you can repeat with whatever is already in your closet. The proportion trick: keep the top defined or add a structured layer. Save this before getting dressed.",
      [
        slide("IF YOU OWN WIDE-LEG TROUSERS, COPY THESE 4 FORMULAS", "hero", [group("THE BASE", [A.trousers, A.tee, A.cardigan, A.layer])]),
        slide("FORMULAS 01 + 02", "columns", [
          group("01 / EASY", [A.tee, A.trousers], "Fitted tee + wide trousers"),
          group("02 / SOFT", [A.cardigan, A.trousers], "Short knit + wide trousers")
        ]),
        slide("FORMULAS 03 + 04", "columns", [
          group("03 / POLISHED", [A.trousers, A.loafer], "Add a structured shoe"),
          group("04 / LAYERED", [A.trousers, A.layer], "Add one structured layer")
        ]),
        slide("THE PROPORTION TRICK", "comparison", [
          group("DEFINED TOP", [A.tee, A.trousers], "Creates a clear waist"),
          group("STRUCTURED LAYER", [A.trousers, A.layer], "Creates a clean vertical line")
        ]),
        slide("ONE BOTTOM. FOUR OUTFITS.", "rows", [
          group("CASUAL", [A.tee], "tee"),
          group("SOFT", [A.cardigan], "knit"),
          group("SHARP", [A.layer], "layer")
        ], { subtitle: "Save the formula, then use your own pieces." })
      ]
    )
  },
  {
    slug: "shoe-changes-outfit",
    name: "ONE CHANGE",
    make: () => post(
      "shoe-changes-outfit",
      "ONE CHANGE",
      "THE SHOE CHANGES THE WHOLE OUTFIT",
      "Same top. Same skirt. A completely different message from the shoe. Sneakers read casual, loafers polished, and a red heel turns the shoe into the focal point. Which version wins?",
      [
        slide("THE SHOE CHANGES THE WHOLE OUTFIT", "hero", [group("SAME CLOTHES", [A.tee, A.skirt, A.sneaker, A.loafer])], { subtitle: "Change one item. Change the whole mood." }),
        slide("01 / CASUAL", "split", [group("WHITE SNEAKER", [A.tee, A.skirt, A.sneaker], "Relaxed, practical, daytime.")]),
        slide("02 / POLISHED", "split", [group("BLACK LOAFER", [A.tee, A.skirt, A.loafer], "Sharper, quieter, work-ready.")]),
        slide("03 / BOLD", "split", [group("RED HEEL", [A.tee, A.skirt, A.heel], "The shoe becomes the focal point.")]),
        slide("SAME BASE. THREE MOODS.", "columns", [
          group("CASUAL", [A.sneaker], "weekend"),
          group("POLISHED", [A.loafer], "work"),
          group("BOLD", [A.heel], "evening")
        ], { subtitle: "Save this before buying another outfit." })
      ]
    )
  },
  {
    slug: "weather-outfits",
    name: "WHAT TO WEAR",
    make: () => post(
      "weather-outfits",
      "WHAT TO WEAR",
      "WHAT TO WEAR AT 12°C / 16°C / 20°C",
      "A simple transitional-weather guide: change the number of layers, not your whole wardrobe. Adjust for wind, rain and how warm you personally run. Save it for the next confusing forecast.",
      [
        slide("WHAT TO WEAR AT 12°C / 16°C / 20°C", "hero", [group("TRANSITIONAL WEATHER", [A.layer, A.cardigan, A.tee, A.trousers])]),
        slide("12°C / LAYER TWICE", "split", [group("WARMER FORMULA", [A.tee, A.cardigan, A.layer, A.trousers], "Base + knit + outer layer + full-length bottom")]),
        slide("16°C / KEEP ONE LAYER", "split", [group("MIDDLE FORMULA", [A.cardigan, A.skirt, A.loafer], "Light knit + midi bottom + closed shoe")]),
        slide("20°C / LIGHTEN THE BASE", "split", [group("LIGHT FORMULA", [A.tee, A.skirt, A.sneaker], "Short sleeve + light bottom + sneaker")]),
        slide("THE TEMPERATURE RULE", "rows", [
          group("12°C", [A.layer], "two light layers"),
          group("16°C", [A.cardigan], "one light layer"),
          group("20°C", [A.tee], "breathable base")
        ], { subtitle: "Wind and rain can shift this by one layer." })
      ]
    )
  },
  {
    slug: "three-dress-codes",
    name: "ONE PIECE",
    make: () => post(
      "three-dress-codes",
      "ONE PIECE",
      "ONE SKIRT. THREE DRESS CODES.",
      "You do not need three different outfits. Keep the skirt, then change the top and shoe to move it from casual to work to evening. Save this repeatable one-piece formula.",
      [
        slide("ONE SKIRT. THREE DRESS CODES.", "hero", [group("THE HERO PIECE", [A.skirt, A.tee, A.cardigan, A.layer])]),
        slide("01 / CASUAL", "split", [group("KEEP IT RELAXED", [A.tee, A.skirt, A.sneaker], "Fitted tee + sneaker")]),
        slide("02 / WORK", "split", [group("ADD STRUCTURE", [A.cardigan, A.skirt, A.loafer], "Fine knit + polished loafer")]),
        slide("03 / EVENING", "split", [group("ADD A FOCAL POINT", [A.layer, A.skirt, A.heel], "Strong color + pointed heel")]),
        slide("THE ONE-PIECE FORMULA", "rows", [
          group("CASUAL", [A.sneaker], "relaxed shoe"),
          group("WORK", [A.loafer], "structured shoe"),
          group("EVENING", [A.heel], "statement shoe")
        ], { subtitle: "Keep the hero piece. Change the supporting pieces." })
      ]
    )
  },
  {
    slug: "outfit-feels-flat",
    name: "FIX THE OUTFIT",
    make: () => post(
      "outfit-feels-flat",
      "FIX THE OUTFIT",
      "IF YOUR OUTFIT FEELS FLAT, CHANGE ONE THING",
      "Before changing the whole outfit, try changing one variable: color, texture or layer. The goal is not to add more—it is to add one clear point of contrast. Save this three-step outfit check.",
      [
        slide("IF YOUR OUTFIT FEELS FLAT, CHANGE ONE THING", "hero", [group("COLOR / TEXTURE / LAYER", [A.tee, A.trousers, A.skirt, A.layer])]),
        slide("01 / CHANGE THE COLOR", "comparison", [
          group("QUIET", [A.tee, A.trousers], "tonal"),
          group("FOCAL POINT", [A.layer, A.trousers], "high contrast")
        ]),
        slide("02 / CHANGE THE TEXTURE", "comparison", [
          group("MATTE", [A.tee, A.trousers], "cotton + tailoring"),
          group("MIXED", [A.cardigan, A.skirt], "knit + satin")
        ]),
        slide("03 / ADD A LAYER", "comparison", [
          group("BEFORE", [A.tee, A.trousers], "two pieces"),
          group("AFTER", [A.trousers, A.layer], "one clear third piece")
        ]),
        slide("THE 10-SECOND CHECK", "rows", [
          group("COLOR", [A.layer], "Is there one focal point?"),
          group("TEXTURE", [A.skirt], "Is everything too similar?"),
          group("LAYER", [A.cardigan], "Does it need a third piece?")
        ])
      ]
    )
  },
  {
    slug: "easiest-formula",
    name: "OUTFIT FORMULAS",
    make: () => post(
      "easiest-formula",
      "OUTFIT FORMULAS",
      "THE EASIEST OUTFIT FORMULA",
      "A fitted top, a wide bottom and one structured layer: three simple shape roles you can recreate with different colors and categories. Save the formula, not the exact pieces.",
      [
        slide("THE EASIEST OUTFIT FORMULA", "formula", [
          group("FITTED", [A.tee], "top"),
          group("WIDE", [A.trousers], "bottom"),
          group("STRUCTURED", [A.layer], "layer")
        ]),
        slide("STEP 1 / DEFINE THE TOP", "split", [group("FITTED", [A.tee, A.trousers], "A closer top balances volume below.")]),
        slide("STEP 2 / ADD WIDTH BELOW", "split", [group("WIDE", [A.cardigan, A.trousers], "Keep one half of the outfit visually simple.")]),
        slide("STEP 3 / FINISH WITH STRUCTURE", "split", [group("STRUCTURED", [A.tee, A.trousers, A.layer], "The third piece creates a clean outer line.")]),
        slide("COPY THE SHAPES, NOT THE ITEMS", "formula", [
          group("FITTED", [A.cardigan], "top"),
          group("WIDE", [A.skirt], "bottom"),
          group("STRUCTURED", [A.loafer], "shoe")
        ], { subtitle: "The formula still works with different pieces." })
      ]
    )
  },
  {
    slug: "forgotten-colors",
    name: "COLOR PAIRINGS",
    make: () => post(
      "forgotten-colors",
      "COLOR PAIRINGS",
      "3 COLOR COMBINATIONS PEOPLE FORGET",
      "Three less-obvious color combinations using pieces you may already own: cobalt with burgundy, butter with chocolate, and cream with cobalt. Save this mini palette when your outfits feel repetitive.",
      [
        slide("3 COLOR COMBINATIONS PEOPLE FORGET", "hero", [group("SAVE THE PALETTE", [A.layer, A.skirt, A.cardigan, A.trousers])]),
        slide("01 / COBALT + BURGUNDY", "split", [group("COOL + DEEP", [A.layer, A.skirt], "Both colors are strong, but their temperatures balance.", { chips: ["#174CCF", "#6E1836"] })]),
        slide("02 / BUTTER + CHOCOLATE", "split", [group("LIGHT + WARM", [A.cardigan, A.trousers], "A softer alternative to cream and black.", { chips: ["#F1D66A", "#5B3425"] })]),
        slide("03 / CREAM + COBALT", "split", [group("CALM + BRIGHT", [A.tee, A.layer], "The neutral gives the saturated blue room to lead.", { chips: ["#EFE4D2", "#174CCF"] })]),
        slide("USE THE 80 / 20 RULE", "comparison", [
          group("80% BASE", [A.tee], "one calmer color"),
          group("20% ACCENT", [A.layer], "one stronger color")
        ], { subtitle: "You do not need equal amounts of both colors." })
      ]
    )
  },
  {
    slug: "five-basics",
    name: "CLOSET MATH",
    make: () => post(
      "five-basics",
      "CLOSET MATH",
      "5 BASICS. 10 OUTFITS.",
      "Five useful pieces can create more outfits than five exciting pieces that do not work together. Start with two tops, two bottoms and one layer, then add shoes you already own. Save the matrix.",
      [
        slide("5 BASICS. 10 OUTFITS.", "hero", [group("START WITH FOUR", [A.tee, A.cardigan, A.trousers, A.skirt])], { subtitle: "The fifth piece is a layer." }),
        slide("THE FIVE-PIECE BASE", "rows", [
          group("2 TOPS", [A.tee, A.cardigan], "fitted tee + knit"),
          group("2 BOTTOMS", [A.trousers, A.skirt], "wide trousers + midi skirt")
        ], { subtitle: "Piece 5 is one structured layer." }),
        slide("THE FIRST FOUR OUTFITS", "columns", [
          group("TOP 1", [A.tee, A.trousers], "+ either bottom"),
          group("TOP 2", [A.cardigan, A.skirt], "+ either bottom")
        ]),
        slide("LOOK 05 / ADD THE LAYER", "split", [group("FIRST PAIR", [A.tee, A.trousers, A.layer], "Layer over top 1 + bottom 1")]),
        slide("LOOK 06 / MOVE THE LAYER", "split", [group("SECOND PAIR", [A.cardigan, A.skirt, A.layer], "Move it over top 2 + bottom 2")]),
        slide("THE CLOSET MATH", "formula", [
          group("2 TOPS", [A.tee], "×"),
          group("2 BOTTOMS", [A.trousers], "+"),
          group("1 LAYER", [A.layer], "= 10 looks")
        ], { subtitle: "Change the shoe to shift the dress code." })
      ]
    )
  },
  {
    slug: "third-piece-rule",
    name: "STYLE RULES",
    make: () => post(
      "third-piece-rule",
      "STYLE RULES",
      "THE THIRD-PIECE RULE",
      "When a top and bottom feel unfinished, add one intentional third piece: a cardigan, overshirt or jacket. It is a shortcut, not a law—skip it when the outfit already has enough interest. Save this for a difficult outfit day.",
      [
        slide("THE THIRD-PIECE RULE", "comparison", [
          group("BEFORE", [A.tee, A.trousers], "top + bottom"),
          group("AFTER", [A.trousers, A.layer], "+ one intentional layer")
        ]),
        slide("WHY IT WORKS", "split", [group("ONE MORE LINE", [A.tee, A.trousers, A.layer], "A layer adds depth and creates a clearer silhouette.")]),
        slide("TRY A CARDIGAN", "split", [group("SOFTER", [A.tee, A.trousers, A.cardigan], "Use knitwear when you want low contrast.")]),
        slide("TRY AN OVERSHIRT", "split", [group("SHARPER", [A.tee, A.trousers, A.layer], "Use a structured layer for a stronger outline.")]),
        slide("THE RULE IS A TOOL", "comparison", [
          group("ADD IT", [A.layer], "when the outfit feels unfinished"),
          group("SKIP IT", [A.dress], "when one piece already does enough")
        ], { subtitle: "Useful shortcut. Not a fashion law." })
      ]
    )
  }
];

export function makePost(definition, iteration) {
  const result = definition.make();
  const suffix = String(iteration + 1).padStart(3, "0");
  return { ...result, id: `${result.slug}-${suffix}`, issue: suffix };
}
