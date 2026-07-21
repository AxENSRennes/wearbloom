# WearBloom — Whering Inspiration and Product Boundaries

**Status:** Product inspiration reference
**Reference product:** Whering
**Purpose:** Define which Whering patterns WearBloom should learn from, how AI should improve them, and which patterns WearBloom explicitly rejects.

## 1. Product direction

WearBloom should evolve from a personal outfit-rendering product into an AI-powered wardrobe companion: a product with the functional depth of Whering, centered entirely on clothes the user already owns.

WearBloom is not a shopping app. It should help users rediscover, combine, wear, maintain, and better understand their existing wardrobe. AI should reduce the effort required to digitize and organize a closet, suggest useful combinations, and let the user visualize a complete look on herself.

> Wear more of what you already own.

The personal AI render remains the product's most distinctive and monetizable moment. The recurring value comes from helping the user make better use of her wardrobe every day.

This document treats “no in-app purchases” as no clothing marketplace, retailer checkout, affiliate commerce, or product-purchase links. A WearBloom subscription may still fund expensive AI generation without conflicting with this principle.

## 2. What WearBloom should learn from Whering

Whering is most valuable as a reference for five connected product loops:

1. digitizing a wardrobe;
2. composing and saving outfits;
3. discovering new combinations;
4. planning and recording what was worn;
5. understanding wardrobe usage.

WearBloom should preserve these loops while making them faster, calmer, more private, and more useful through AI.

## 3. Wardrobe digitization

### Inspiration to keep

Whering's [item-upload flow](https://mobbin.com/flows/af4ef40b-1307-45e3-9a42-d2c3d46a363c) supports selecting multiple photos and processing them before displaying the new items in the wardrobe. Its [digitization guide](https://mobbin.com/flows/15956c53-4202-40e8-a343-f12cc285a6aa) teaches users how to photograph or collect item images efficiently.

WearBloom should take inspiration from:

- batch import from Photos;
- a clear camera and photo guide;
- visual processing feedback;
- a wardrobe grid organized by category;
- the ability to review uncertain results later;
- progressive digitization rather than requiring the entire closet upfront.

### How AI should improve it

AI should automatically:

- remove or clean the background;
- identify category and subcategory;
- detect dominant colors and patterns;
- infer likely material, season, and formality when confidence is sufficient;
- detect probable duplicates;
- ask for confirmation only when the classification is uncertain.

The default review screen should contain a large item image, a concise detected label such as `Top · Cardigan`, a few editable attributes, and a single `Add to Closet` action.

### What WearBloom rejects

Whering's [item-details flow](https://mobbin.com/flows/bbb59b34-c236-4857-ae27-a73073ebb046) can ask for category, brand, size, colors, tags, season, occasion, mood, price, purchase date, resale value, material, care instructions, status, and location.

WearBloom rejects:

- forcing users to complete long metadata forms;
- blocking creation until every item is fully categorized;
- asking for brand, price, or purchase data during the primary journey;
- implying that a complete wardrobe import is required before value is delivered.

Optional metadata may remain available from an item's detail page, but it must never interrupt first-use value.

## 4. Outfit composition

### Inspiration to keep

Whering's [outfit-creation flow](https://mobbin.com/flows/90aa0f49-b537-4441-b5e8-7f4f1162c943) uses a category-filtered wardrobe grid, immediate visual selection, a persistent selection count, and an outfit canvas. Finished outfits can be saved or organized into [lookbooks](https://mobbin.com/flows/147e329e-d03f-4578-9bfd-f525a8fcad5c).

WearBloom should take inspiration from:

- image-first garment selection;
- horizontal category filters;
- a persistent action showing the number of selected items;
- fast replacement of an individual garment;
- saved outfits and themed lookbooks;
- a clear final composition before generation.

### How WearBloom should adapt it

WearBloom should use structured composition rather than requiring precise freeform layout:

- one active garment per category;
- a dress replaces top and bottom;
- outerwear remains optional;
- empty categories are understandable at a glance;
- the app creates a polished editorial arrangement automatically;
- manual repositioning is optional rather than required.

AI should add two actions:

- `Style this look` — complete or improve a composition using only owned garments;
- `See it on me` — generate a personal image using the user's selected reference photo.

### What WearBloom rejects

- mandatory drag-and-drop composition;
- a graphic-design tool disguised as an outfit builder;
- complex layering rules at launch;
- adding shoes, bags, and accessories before the primary garment flow is excellent;
- overwriting previous generated variants when a look is edited.

## 5. AI styling and wardrobe rediscovery

### Inspiration to keep

Whering's [Dress Me flow](https://mobbin.com/flows/6572e1fe-f020-468c-84df-649ffe2ec3a9) lets users rotate through garment categories. Its [outfit shuffle](https://mobbin.com/flows/d3481e93-9a99-4448-b74b-f08d95ad3ffd) presents combinations that can be accepted, rejected, or saved.

These flows show the value of lightweight discovery, but WearBloom should replace random shuffling with contextual AI.

### WearBloom's AI styling opportunities

The user should be able to request or select intents such as:

- `Something for work`;
- `Use this skirt`;
- `A look for 18°C and rain`;
- `Something I have not worn recently`;
- `Restyle yesterday's trousers`;
- `Make this outfit more formal`;
- `Pack three looks using six pieces`;
- `Give me a new combination from my favorites`.

Every recommendation must be constrained to garments the user owns. When useful, the app should explain a recommendation in plain language:

> I chose this jacket because you have not worn it in 42 days and it works with three pieces you wear often.

The explanation should build confidence without pretending that the model understands exact fit, sizing, drape, or body shape.

### What WearBloom rejects

- recommendations containing unowned products;
- `Shop similar` fallbacks;
- recommendations optimized for affiliate revenue;
- unexplained suggestions that appear arbitrary;
- engagement loops based on endless random shuffling;
- claims that AI can predict exact fit or body appearance.

## 6. Planning and wear tracking

### Inspiration to keep

Whering's [calendar](https://mobbin.com/flows/2f44a259-9032-447c-a05b-e4fdae52eb60) displays planned outfits on individual days. Its [planner](https://mobbin.com/flows/0542c4a1-1c3d-453c-b78a-d8a275e340ea) allows a user to select an existing outfit or create a new one. The user can also [upload an outfit-of-the-day photo](https://mobbin.com/flows/5196a8b4-4507-4e82-96be-e2d8b226c13d).

WearBloom should take inspiration from:

- assigning a saved outfit to a date;
- a lightweight `What are you wearing today?` entry point;
- recording whether an outfit was actually worn;
- keeping the real-wear history separate from generated images;
- optional OOTD photos;
- using wear history to improve future recommendations.

### The ideal WearBloom loop

1. WearBloom suggests or helps compose an outfit.
2. The user edits or accepts it.
3. She optionally generates a personal render.
4. She saves or plans the look.
5. WearBloom later asks `Did you wear it?`.
6. A positive response updates usage for every garment in the look.
7. A negative response may collect an optional reason such as weather, comfort, occasion, or an unconvincing result.

A single `Mark as worn` action must be enough to maintain useful history. Uploading a real OOTD photo must remain optional.

### What WearBloom rejects

- forcing daily logging;
- streaks or guilt-based notifications;
- treating a generated render as proof that an outfit was worn;
- making the calendar a prerequisite for creating a look;
- marketing notifications disguised as wardrobe reminders.

## 7. Wardrobe insights and anti-overconsumption

### Inspiration to keep

Whering's [wardrobe statistics](https://mobbin.com/flows/b128374d-d439-4ffa-abfa-2b2c1d3fac1d) include wardrobe composition, common pairings, and most- and least-worn items. Its [item statistics](https://mobbin.com/flows/f5b4216e-ca70-424c-90d8-98490c85e7b5) can track wears, repairs, and dry cleaning.

WearBloom should focus on positive, actionable insights:

- percentage of the wardrobe worn recently;
- garments returned to rotation;
- new combinations created from existing items;
- most- and least-worn garments;
- favorite outfits and pairings;
- cost per wear when the user voluntarily provides a price;
- pieces that may need care or repair;
- wardrobe categories with unnecessary duplication;
- combinations that create more use from a small group of pieces.

AI may turn these signals into supportive observations and suggestions, but the underlying facts should remain visible and understandable.

### What WearBloom rejects

- guilt, shame, or moral scoring;
- fragile or exaggerated environmental-impact claims;
- gamifying the total number or monetary value of owned garments;
- celebrating wardrobe growth;
- inventing sustainability numbers that cannot be substantiated;
- using insight data to target clothing advertisements.

The tone should be `Rediscover what you own`, not `You are consuming incorrectly`.

## 8. Care, repair, and wardrobe lifecycle

### Inspiration to keep

Whering's [item details](https://mobbin.com/flows/32b4269b-c7d6-4b23-bb49-bb672270068d) include usage and care information. Its statistics can record repairs and professional cleaning, while its [archive flow](https://mobbin.com/flows/73efec9c-1092-481a-b30b-674e8eb0fbcb) removes an inactive item from the primary wardrobe without immediately deleting its history.

Longer term, WearBloom may support:

- care instructions detected from a label photo;
- repair history and reminders;
- a simple clean / laundry / unavailable state;
- archiving with a reversible action;
- user-recorded outcomes such as donated, swapped, repaired, or recycled;
- AI suggestions for restyling an underused item before removing it.

### What WearBloom rejects

- an internal resale marketplace;
- encouraging frequent wardrobe turnover;
- treating resale value as a primary garment attribute;
- prompting users to replace an item when repair or restyling is viable;
- deleting usage history by default when an item leaves the active closet.

## 9. Shopping and commerce boundaries

Whering includes a [shop](https://mobbin.com/flows/3b57f3f1-2f60-47f7-be76-1e1885a0e186), [merchant wishlists](https://mobbin.com/flows/9213412a-9e52-450c-b4b5-4f567b819f5b), retailer links, and external product discovery.

WearBloom explicitly rejects:

- a clothing shop or marketplace;
- retailer checkout;
- affiliate links or commissions;
- sponsored product recommendations;
- `Buy the missing piece` messaging;
- links to product pages from AI suggestions;
- notifications about discounts, drops, trends, or new collections;
- advertising based on wardrobe contents or personal photos.

If a generated look cannot be completed, WearBloom should find another combination from the existing closet rather than recommend a purchase.

### Possible future alternative: Pause List

Instead of a conventional wishlist, WearBloom may eventually offer a private `Pause List`. A user could save an image of an item she is considering, and WearBloom could:

- identify similar garments she already owns;
- show how often those garments are worn;
- test whether the considered item creates genuinely new combinations;
- impose an optional reflection period;
- let the user dismiss the item without providing a purchase link.

The purpose would be to support a deliberate decision, not facilitate conversion.

## 10. Social and sharing boundaries

Whering places community and social activity prominently in its navigation and onboarding. WearBloom should remain private by default.

WearBloom may support:

- private sharing of a look or render;
- revocable links;
- asking trusted friends to choose between two looks;
- discreet WearBloom attribution on explicitly shared content.

WearBloom rejects at launch:

- public profiles;
- follower counts;
- public outfit feeds;
- comments and popularity metrics;
- trend-driven recommendations;
- social mechanics that create pressure to acquire new clothing.

## 11. Recommended product architecture

WearBloom should use four primary areas:

1. **Closet** — garments, categories, search, item history, and care;
2. **Style** — manual composition, AI suggestions, saved outfits, and `See it on me`;
3. **Today** — today's outfit, lightweight planning, and `Mark as worn`;
4. **Insights** — wardrobe rotation, usage patterns, and underused pieces.

Saved content may live inside Style under:

- `Outfits`;
- `Rendered`;
- `Lookbooks`.

Profile, subscription, privacy, data deletion, and settings should remain outside the primary tab bar.

## 12. Recommended MVP

### Required for launch

- batch garment import from Photos and Camera;
- local background removal with a graceful fallback;
- AI-assisted garment categorization and correction;
- a searchable and filterable closet;
- structured manual outfit composition;
- AI outfit suggestions using only owned garments;
- personal `See it on me` generation;
- saved outfits and immutable render variants;
- `Mark as worn`;
- basic usage counts and most- / least-worn insights;
- private-by-default images and sharing;
- no clothing commerce or merchant links.

### After product validation

- a full calendar and event planner;
- recommendations informed by weather and occasion;
- learning from accepted, edited, rejected, and worn outfits;
- care, repair, laundry, and archive states;
- lookbooks and capsule wardrobes;
- AI-generated [packing lists](https://mobbin.com/flows/31b343b8-bb61-42a7-9dde-04f471d944c3);
- private compare-and-vote sharing;
- the anti-purchase Pause List.

## 13. Monetization alignment

Manual closet management, outfit composition, wear tracking, and core insights should remain useful without payment. Personal image generation is the natural premium feature because it has direct infrastructure cost and delivers the most distinctive value.

WearBloom may charge for its own AI service while remaining fully opposed to clothing overconsumption. Monetization must never depend on selling garments, affiliate conversion, advertising, or increasing the size of a user's wardrobe.

## 14. Product principles

- The user's existing wardrobe is always the default source of truth.
- AI reduces effort; it does not create more decisions or forms.
- A recommendation must never require a purchase.
- The product celebrates reuse, rotation, care, and personal creativity.
- Personal renders inspire decisions but never claim exact physical prediction.
- Generated images and real wear history remain clearly distinguished.
- Private data and photos never become social content without explicit consent.
- Technical failures never consume a paid generation.
- Useful wardrobe features remain valuable even when the user does not generate an image.

## 15. Positioning

Recommended primary proposition:

> Your wardrobe, made new again.

Supporting proposition:

> Style what you own, discover new combinations, and see them on you.

WearBloom's differentiation is not simply a better digital closet. It is the shortest path from `These are the clothes I own` to `Here is a new way I can confidently wear them`.
