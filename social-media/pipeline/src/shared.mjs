import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function readJson(file) {
  return JSON.parse(await fs.readFile(path.resolve(root, file), "utf8"));
}

export function loadSharp() {
  const req = createRequire(import.meta.url);
  try {
    return req("sharp");
  } catch (localError) {
    const modules = process.env.WEARBLOOM_BUNDLED_NODE_MODULES;
    if (!modules) {
      throw new Error("Install dependencies with npm install, or set WEARBLOOM_BUNDLED_NODE_MODULES.", { cause: localError });
    }
    return createRequire(path.join(modules, "package.json"))("sharp");
  }
}

export function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function rng(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function parseArgs(argv) {
  const result = { count: 10, seed: new Date().toISOString().slice(0, 10), series: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--count") result.count = Number(argv[++index]);
    else if (token === "--seed") result.seed = argv[++index];
    else if (token === "--series") result.series = argv[++index];
    else if (token === "--help") result.help = true;
    else throw new Error(`Unknown option: ${token}`);
  }
  if (!Number.isInteger(result.count) || result.count < 1 || result.count > 100) {
    throw new Error("--count must be an integer between 1 and 100.");
  }
  return result;
}

export const escapeXml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export function wrap(text, maxCharacters) {
  const lines = [];
  for (const paragraph of String(text).split("\n")) {
    const words = paragraph.trim().split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && next.length > maxCharacters) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}
