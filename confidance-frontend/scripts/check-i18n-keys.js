/**
 * Compare i18n common.json: list keys present in EN (or FR) but missing in ES, RU, ZH.
 * Usage: node scripts/check-i18n-keys.js [--out report.txt]
 */

const fs = require('fs');
const path = require('path');
const outFile = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
let log = '';
function print(s) {
  const line = s + '\n';
  log += line;
  process.stdout.write(line);
}

const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const LANGS = ['en', 'fr', 'es', 'ru', 'zh'];

function getAllKeyPaths(obj, prefix = '') {
  const paths = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length > 0) {
      paths.push(...getAllKeyPaths(val, fullKey));
    } else {
      paths.push(fullKey);
    }
  }
  return paths;
}

function getValueAtPath(obj, pathStr) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function loadJson(lang) {
  const file = path.join(LOCALES_DIR, lang, 'common.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`Error loading ${lang}:`, e.message);
    return null;
  }
}

const refLang = 'en';
const ref = loadJson(refLang);
if (!ref) {
  console.error('Reference locale (en) not found.');
  process.exit(1);
}

const allPaths = getAllKeyPaths(ref);
print(`\nReference: ${refLang} — ${allPaths.length} keys total.\n`);

const data = {};
for (const lang of LANGS) {
  data[lang] = loadJson(lang);
}

// For each language, list missing keys (compared to EN)
for (const lang of LANGS) {
  if (lang === refLang) continue;
  const obj = data[lang];
  const missing = [];
  for (const keyPath of allPaths) {
    const v = obj ? getValueAtPath(obj, keyPath) : undefined;
    if (v === undefined || v === '') missing.push(keyPath);
  }
  print(`--- ${lang.toUpperCase()} missing (vs EN): ${missing.length} ---`);
  if (missing.length > 0) {
    missing.forEach((k) => print(`  ${k}`));
  }
  print('');
}

// Summary: keys that exist in BOTH en and fr but missing in es, ru, or zh
const enPaths = new Set(getAllKeyPaths(ref));
const fr = data['fr'];
const frPaths = fr ? new Set(getAllKeyPaths(fr)) : new Set();
const inEnAndFr = allPaths.filter((p) => enPaths.has(p) && frPaths.has(p));

print('--- Keys in both EN and FR ---');
print(`Count: ${inEnAndFr.length}\n`);

for (const lang of ['es', 'ru', 'zh']) {
  const obj = data[lang];
  const missing = inEnAndFr.filter((p) => {
    const v = obj ? getValueAtPath(obj, p) : undefined;
    return v === undefined || v === '';
  });
  print(`${lang.toUpperCase()} missing (present in EN+FR): ${missing.length}`);
  if (missing.length <= 50) {
    missing.forEach((k) => print(`  ${k}`));
  } else {
    missing.slice(0, 30).forEach((k) => print(`  ${k}`));
    print(`  ... and ${missing.length - 30} more`);
  }
  print('');
}
if (outFile) {
  fs.writeFileSync(outFile, log, 'utf8');
  process.stdout.write(`\nReport written to ${outFile}\n`);
}
