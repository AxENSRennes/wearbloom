import fs from "node:fs/promises";
import path from "node:path";
import { escapeXml, loadSharp, root, wrap } from "./shared.mjs";

const sharp = loadSharp();

function textBlock({ value, x, y, size, width, weight = 800, fill = "#111111", anchor = "start", lineHeight = 1.03, tracking = -1 }) {
  const max = Math.max(8, Math.floor(width / (size * 0.57)));
  const lines = wrap(value, max);
  const spans = lines.map((line, index) => `<tspan x="${x}" dy="${index ? Math.round(size * lineHeight) : 0}">${escapeXml(line)}</tspan>`).join("");
  return {
    svg: `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${tracking}">${spans}</text>`,
    lines: lines.length,
    height: lines.length * size * lineHeight
  };
}

function plainText(value, x, y, size, options = {}) {
  const { weight = 700, fill = "#111111", anchor = "start", tracking = 1.2 } = options;
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${tracking}">${escapeXml(value)}</text>`;
}

function assetCount(slide) {
  return slide.groups.reduce((sum, entry) => sum + entry.assets.length, 0);
}

async function assetBuffer(item, width, height) {
  return sharp(path.join(root, item.asset))
    .resize({ width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

function gridBoxes(box, count, layout = "auto") {
  const gap = Math.min(24, box.width * 0.05);
  if (count === 1) return [{ ...box }];
  if (layout === "row" || (layout === "auto" && box.width > box.height * 1.25)) {
    const width = (box.width - gap * (count - 1)) / count;
    return Array.from({ length: count }, (_, index) => ({ x: box.x + index * (width + gap), y: box.y, width, height: box.height }));
  }
  if (count === 2) {
    const height = (box.height - gap) / 2;
    return [{ x: box.x, y: box.y, width: box.width, height }, { x: box.x, y: box.y + height + gap, width: box.width, height }];
  }
  const columns = 2;
  const rows = Math.ceil(count / columns);
  const width = (box.width - gap) / columns;
  const height = (box.height - gap * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, index) => ({
    x: box.x + (index % columns) * (width + gap),
    y: box.y + Math.floor(index / columns) * (height + gap),
    width,
    height
  }));
}

function chipsSvg(chips, x, y) {
  return (chips || []).map((color, index) => `<circle cx="${x + index * 62}" cy="${y}" r="23" fill="${color}" stroke="#111111" stroke-width="2"/>`).join("");
}

function cellText(group, cell, compact = false) {
  const labelSize = compact ? 22 : 25;
  const labelY = cell.y + (compact ? 32 : 42);
  let svg = plainText(group.label, cell.x, labelY, labelSize, { tracking: 1.5 });
  let used = compact ? 52 : 64;
  if (group.note) {
    const note = textBlock({ value: group.note, x: cell.x, y: labelY + 38, size: compact ? 21 : 25, width: cell.width, weight: 400, fill: "#555555", lineHeight: 1.18, tracking: 0 });
    svg += note.svg;
    used += note.height + 24;
  }
  if (group.chips?.length) {
    svg += chipsSvg(group.chips, cell.x + 24, cell.y + used + 12);
    used += 75;
  }
  return { svg, used };
}

function layoutPlan(slide, bounds) {
  const placements = [];
  let svg = "";
  const gap = 34;
  const groups = slide.groups;
  const line = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#E5E5E5" stroke-width="3"/>`;

  if (slide.layout === "hero") {
    const group = groups[0];
    svg += plainText(group.label, bounds.x, bounds.y + 38, 24, { tracking: 1.8 });
    const boxes = gridBoxes({ x: bounds.x, y: bounds.y + 75, width: bounds.width, height: bounds.height - 80 }, group.assets.length, "row");
    group.assets.forEach((id, index) => placements.push({ id, ...boxes[index] }));
  } else if (slide.layout === "split") {
    const group = groups[0];
    const textWidth = bounds.width * 0.35;
    const details = cellText(group, { x: bounds.x, y: bounds.y + 16, width: textWidth, height: bounds.height });
    svg += details.svg + line(bounds.x + textWidth + 28, bounds.y, bounds.x + textWidth + 28, bounds.y + bounds.height);
    const visual = { x: bounds.x + textWidth + 64, y: bounds.y, width: bounds.width - textWidth - 64, height: bounds.height };
    const boxes = gridBoxes(visual, group.assets.length, group.assets.length > 2 ? "auto" : "row");
    group.assets.forEach((id, index) => placements.push({ id, ...boxes[index] }));
  } else if (["columns", "comparison", "formula"].includes(slide.layout)) {
    const columns = groups.length;
    const cellWidth = (bounds.width - gap * (columns - 1)) / columns;
    groups.forEach((group, index) => {
      const cell = { x: bounds.x + index * (cellWidth + gap), y: bounds.y, width: cellWidth, height: bounds.height };
      if (index) svg += line(cell.x - gap / 2, bounds.y, cell.x - gap / 2, bounds.y + bounds.height);
      const details = cellText(group, cell, columns === 3);
      svg += details.svg;
      const visualY = cell.y + Math.max(details.used, columns === 3 ? 150 : 180);
      const boxes = gridBoxes({ x: cell.x, y: visualY, width: cell.width, height: Math.max(80, cell.height - (visualY - cell.y)) }, group.assets.length);
      group.assets.forEach((id, assetIndex) => placements.push({ id, ...boxes[assetIndex] }));
      if (slide.layout === "formula" && index < columns - 1) {
        svg += plainText("+", cell.x + cell.width + gap / 2, bounds.y + bounds.height * 0.55, 56, { weight: 400, anchor: "middle", tracking: 0 });
      }
    });
  } else if (slide.layout === "rows") {
    const rowGap = 20;
    const rowHeight = (bounds.height - rowGap * (groups.length - 1)) / groups.length;
    groups.forEach((group, index) => {
      const y = bounds.y + index * (rowHeight + rowGap);
      if (index) svg += line(bounds.x, y - rowGap / 2, bounds.x + bounds.width, y - rowGap / 2);
      const textWidth = bounds.width * 0.38;
      const details = cellText(group, { x: bounds.x, y, width: textWidth, height: rowHeight }, true);
      svg += details.svg;
      const visual = { x: bounds.x + textWidth + 30, y: y + 4, width: bounds.width - textWidth - 30, height: rowHeight - 8 };
      const boxes = gridBoxes(visual, group.assets.length, "row");
      group.assets.forEach((id, assetIndex) => placements.push({ id, ...boxes[assetIndex] }));
    });
  } else {
    throw new Error(`Unsupported layout: ${slide.layout}`);
  }
  return { svg, placements };
}

export async function renderSlide({ post, slide, slideIndex, format, dimensions, catalog, destination }) {
  const { width, height } = dimensions;
  const tall = height > 1500;
  const margin = 64;
  const titleSize = tall ? 68 : 64;
  const titleWidth = width - margin * 2 - 110;
  const title = textBlock({ value: slide.title, x: margin, y: tall ? 132 : 112, size: titleSize, width: titleWidth, lineHeight: 1.01 });
  const titleBottom = (tall ? 132 : 112) + title.height;
  let header = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#FFFFFF"/>`;
  header += plainText(post.series, margin, tall ? 58 : 46, 18, { fill: "#666666", tracking: 2.2 });
  header += plainText(`${String(slideIndex + 1).padStart(2, "0")} / ${String(post.slides.length).padStart(2, "0")}`, width - margin, tall ? 58 : 46, 18, { fill: "#666666", anchor: "end", tracking: 1 });
  header += title.svg;
  let contentTop = titleBottom + (tall ? 36 : 26);
  if (slide.subtitle) {
    const subtitle = textBlock({ value: slide.subtitle, x: margin + 2, y: contentTop, size: tall ? 29 : 27, width: width - margin * 2, weight: 400, fill: "#555555", lineHeight: 1.16, tracking: 0 });
    header += subtitle.svg;
    contentTop += subtitle.height + 30;
  }
  header += `<line x1="${margin}" y1="${contentTop}" x2="${width - margin}" y2="${contentTop}" stroke="#E5E5E5" stroke-width="3"/>`;
  contentTop += tall ? 45 : 32;
  const safeBottom = tall ? 230 : 72;
  const bounds = { x: margin, y: contentTop, width: width - margin * 2, height: height - contentTop - safeBottom };
  const body = layoutPlan(slide, bounds);
  header += body.svg;
  header += plainText("SWIPE →", width - margin, height - (tall ? 142 : 32), 17, { fill: "#777777", anchor: "end", tracking: 1.7 });
  header += "</svg>";

  const composites = [{ input: Buffer.from(header), left: 0, top: 0 }];
  for (const placement of body.placements) {
    const item = catalog.get(placement.id);
    if (!item) throw new Error(`Unknown asset ${placement.id}`);
    const inset = Math.min(12, placement.width * 0.03);
    composites.push({
      input: await assetBuffer(item, placement.width - inset * 2, placement.height - inset * 2),
      left: Math.round(placement.x + inset),
      top: Math.round(placement.y + inset)
    });
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await sharp({ create: { width, height, channels: 3, background: "white" } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(destination);
}

export async function renderPreview(files, destination, dimensions) {
  const thumbWidth = 216;
  const thumbHeight = Math.round(thumbWidth * dimensions.height / dimensions.width);
  const gap = 18;
  const margin = 24;
  const width = margin * 2 + files.length * thumbWidth + (files.length - 1) * gap;
  const height = margin * 2 + thumbHeight;
  const composites = [];
  for (let index = 0; index < files.length; index += 1) {
    composites.push({
      input: await sharp(files[index]).resize(thumbWidth, thumbHeight).png().toBuffer(),
      left: margin + index * (thumbWidth + gap),
      top: margin
    });
  }
  await sharp({ create: { width, height, channels: 3, background: "#E8E8E5" } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(destination);
}

export async function renderBatchPreview(files, destination, dimensions) {
  const columns = Math.min(5, files.length);
  const rows = Math.ceil(files.length / columns);
  const thumbWidth = 216;
  const thumbHeight = Math.round(thumbWidth * dimensions.height / dimensions.width);
  const gap = 18;
  const margin = 24;
  const labelHeight = 38;
  const width = margin * 2 + columns * thumbWidth + (columns - 1) * gap;
  const height = margin * 2 + rows * (thumbHeight + labelHeight) + (rows - 1) * gap;
  const composites = [];
  for (let index = 0; index < files.length; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + column * (thumbWidth + gap);
    const y = margin + row * (thumbHeight + labelHeight + gap);
    composites.push({ input: await sharp(files[index]).resize(thumbWidth, thumbHeight).png().toBuffer(), left: x, top: y });
    composites.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${thumbWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#111111"/><text x="12" y="26" font-family="Arial" font-size="18" font-weight="800" fill="#FFFFFF">${String(index + 1).padStart(2, "0")}</text></svg>`),
      left: x,
      top: y + thumbHeight
    });
  }
  await sharp({ create: { width, height, channels: 3, background: "#E8E8E5" } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(destination);
}

export async function renderPost({ post, config, catalog, batchDir }) {
  const postDir = path.join(batchDir, post.id);
  const rendered = {};
  for (const [format, dimensions] of Object.entries(config.formats)) {
    const formatDir = path.join(postDir, format);
    const files = [];
    for (let index = 0; index < post.slides.length; index += 1) {
      const destination = path.join(formatDir, `${String(index + 1).padStart(2, "0")}.png`);
      await renderSlide({ post, slide: post.slides[index], slideIndex: index, format, dimensions, catalog, destination });
      files.push(destination);
    }
    await renderPreview(files, path.join(postDir, `preview-${format}.png`), dimensions);
    rendered[format] = files.map((file) => path.relative(root, file));
  }
  await fs.writeFile(path.join(postDir, "caption.txt"), `${post.caption}\n\n${config.hashtags.join(" ")}\n`, "utf8");
  await fs.writeFile(path.join(postDir, "recipe.json"), `${JSON.stringify(post, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(postDir, "manifest.json"), `${JSON.stringify({
    id: post.id,
    status: "ready-for-human-review",
    language: config.language,
    hook: post.hook,
    slideCount: post.slides.length,
    assetCount: post.slides.map(assetCount),
    files: rendered
  }, null, 2)}\n`, "utf8");
  return { postDir, rendered };
}
