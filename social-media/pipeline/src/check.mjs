import fs from "node:fs/promises";
import path from "node:path";
import { loadSharp, readJson, root } from "./shared.mjs";

const sharp = loadSharp();
const config = await readJson("config.json");
const catalogData = await readJson("catalog.json");
const errors = [];

for (const item of catalogData.items) {
  try {
    const metadata = await sharp(path.join(root, item.asset)).metadata();
    if (!metadata.hasAlpha) errors.push(`${item.id}: cutout has no alpha channel`);
    if (!item.publishable) errors.push(`${item.id}: source rights are not approved`);
  } catch (error) {
    errors.push(`${item.id}: ${error.message}`);
  }
}

const outputRoot = path.join(root, "output");
for (const batch of await fs.readdir(outputRoot, { withFileTypes: true })) {
  if (!batch.isDirectory()) continue;
  const batchDir = path.join(outputRoot, batch.name);
  for (const post of await fs.readdir(batchDir, { withFileTypes: true })) {
    if (!post.isDirectory()) continue;
    const manifestPath = path.join(batchDir, post.name, "manifest.json");
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      for (const [format, files] of Object.entries(manifest.files)) {
        const expected = config.formats[format];
        for (const file of files) {
          const metadata = await sharp(path.join(root, file)).metadata();
          if (metadata.width !== expected.width || metadata.height !== expected.height) {
            errors.push(`${file}: expected ${expected.width}x${expected.height}, got ${metadata.width}x${metadata.height}`);
          }
        }
      }
    } catch (error) {
      errors.push(`${path.relative(root, manifestPath)}: ${error.message}`);
    }
  }
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`OK — ${catalogData.items.length} publishable assets and all rendered posts are valid.\n`);
