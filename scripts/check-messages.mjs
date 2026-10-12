import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MESSAGES_DIR = join("src", "messages");
const SOURCE_LOCALE = "ar";

function flattenKeys(value, prefix) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function readCatalog(locale) {
  const path = join(MESSAGES_DIR, `${locale}.json`);

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`Could not read ${path}: ${error.message}`);
    process.exit(1);
  }
}

const locales = readdirSync(MESSAGES_DIR)
  .filter((entry) => entry.endsWith(".json"))
  .map((entry) => entry.replace(/\.json$/, ""));

if (!locales.includes(SOURCE_LOCALE)) {
  console.error(`Missing the source catalog ${SOURCE_LOCALE}.json in ${MESSAGES_DIR}.`);
  process.exit(1);
}

const sourceKeys = flattenKeys(readCatalog(SOURCE_LOCALE), "");
const sourceKeySet = new Set(sourceKeys);

let failed = false;

for (const locale of locales) {
  if (locale === SOURCE_LOCALE) continue;

  const localeKeySet = new Set(flattenKeys(readCatalog(locale), ""));
  const missing = sourceKeys.filter((key) => !localeKeySet.has(key));
  const extra = [...localeKeySet].filter((key) => !sourceKeySet.has(key));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`${locale}.json matches ${SOURCE_LOCALE}.json (${sourceKeySet.size} keys).`);
    continue;
  }

  failed = true;

  for (const key of missing) {
    console.error(`${locale}.json is missing key: ${key}`);
  }

  for (const key of extra) {
    console.error(`${locale}.json has a key absent from ${SOURCE_LOCALE}.json: ${key}`);
  }
}

process.exit(failed ? 1 : 0);
