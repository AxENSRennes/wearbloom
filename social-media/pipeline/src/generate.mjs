import fs from "node:fs/promises";
import path from "node:path";
import { makePost, series } from "./series.mjs";
import { parseArgs, readJson, root, shuffle, rng } from "./shared.mjs";
import { renderBatchPreview, renderPost } from "./render.mjs";

function usage() {
  return `WearBloom social pipeline\n\nUsage:\n  npm run generate -- [--count 10] [--seed launch-001] [--series slug]\n\nSeries:\n${series.map((entry) => `  - ${entry.slug}`).join("\n")}\n`;
}

function validate(post, config, catalog) {
  const errors = [];
  if (post.slides.length < config.rules.minSlides || post.slides.length > config.rules.maxSlides) errors.push(`${post.id}: invalid slide count`);
  if (post.caption.length > config.rules.maxCaptionCharacters) errors.push(`${post.id}: caption is too long`);
  for (const [index, slide] of post.slides.entries()) {
    if (slide.title.length > config.rules.maxTitleCharacters) errors.push(`${post.id} slide ${index + 1}: title is too long`);
    const ids = slide.groups.flatMap((group) => group.assets);
    if (ids.length > config.rules.maxAssetsPerSlide) errors.push(`${post.id} slide ${index + 1}: ${ids.length} assets exceeds limit`);
    for (const id of ids) {
      const item = catalog.get(id);
      if (!item) errors.push(`${post.id} slide ${index + 1}: unknown asset ${id}`);
      else if (!item.publishable) errors.push(`${post.id} slide ${index + 1}: ${id} is not publishable`);
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  process.stdout.write(usage());
  process.exit(0);
}

const config = await readJson("config.json");
const catalogData = await readJson("catalog.json");
const catalog = new Map(catalogData.items.map((item) => [item.id, item]));
for (const item of catalog.values()) {
  if (item.publishable) await fs.access(path.join(root, item.asset));
}

let pool = series;
if (args.series) {
  pool = series.filter((entry) => entry.slug === args.series);
  if (!pool.length) throw new Error(`Unknown series '${args.series}'.\n\n${usage()}`);
}

const random = rng(args.seed);
const ordered = shuffle(pool, random);
const posts = Array.from({ length: args.count }, (_, index) => {
  const definition = ordered[index % ordered.length];
  const cycle = Math.floor(index / ordered.length);
  return makePost(definition, cycle);
});

for (const post of posts) validate(post, config, catalog);

const safeSeed = String(args.seed).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "batch";
const batchId = `${safeSeed}-${String(args.count).padStart(2, "0")}`;
const batchDir = path.join(root, "output", batchId);
const recipeDir = path.join(root, "recipes", "generated", batchId);
await fs.mkdir(batchDir, { recursive: true });
await fs.mkdir(recipeDir, { recursive: true });

const queue = ["order,id,series,hook,instagram_preview,tiktok_preview,status"];
const covers = [];
for (const [index, post] of posts.entries()) {
  await fs.writeFile(path.join(recipeDir, `${post.id}.json`), `${JSON.stringify(post, null, 2)}\n`, "utf8");
  const result = await renderPost({ post, config, catalog, batchDir });
  covers.push(path.join(root, result.rendered.instagram[0]));
  const relative = path.relative(root, result.postDir);
  const csv = [
    index + 1,
    post.id,
    post.series,
    post.hook,
    `${relative}/preview-instagram.png`,
    `${relative}/preview-tiktok.png`,
    "ready-for-human-review"
  ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",");
  queue.push(csv);
  process.stdout.write(`[${index + 1}/${posts.length}] ${post.id}\n`);
}

await renderBatchPreview(covers, path.join(batchDir, "preview-covers-instagram.png"), config.formats.instagram);

await fs.writeFile(path.join(batchDir, "queue.csv"), `${queue.join("\n")}\n`, "utf8");
await fs.writeFile(path.join(batchDir, "batch.json"), `${JSON.stringify({
  id: batchId,
  seed: args.seed,
  count: posts.length,
  language: config.language,
  createdAt: new Date().toISOString(),
  posts: posts.map(({ id, series: postSeries, hook }) => ({ id, series: postSeries, hook }))
}, null, 2)}\n`, "utf8");

process.stdout.write(`\nGenerated ${posts.length} posts in ${batchDir}\n`);
