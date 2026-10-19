#!/usr/bin/env node
/**
 * Translation report: compares every UI dictionary with English and lists
 * missing keys, unknown keys, {placeholder} mismatches (! = error, ? = check) and array-length
 * differences, plus which long-form pages exist per language. Pages and FAQ files are parsed
 * as the build parses them, so a YAML mistake shows up here rather than in `pnpm build`.
 *
 *   pnpm i18n:check          report for all languages
 *   pnpm i18n:check de fr    report for some languages
 *
 * Exits with code 1 if a language marked "_status": "complete" has problems,
 * so it can run in CI before a release.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const uiDir = join(root, 'src/i18n/ui');
const pagesDir = join(root, 'src/content/pages');
const faqDir = join(root, 'src/content/faq');

const load = (lang) => JSON.parse(readFileSync(join(uiDir, `${lang}.json`), 'utf8'));
const en = load('en');
const pageSlugs = readdirSync(join(pagesDir, 'en')).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const placeholders = (s) => new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

/** Unknown placeholders break the page (shown literally); missing ones are only worth a look. */
function checkPlaceholders(p, ours, theirs, out) {
  const a = placeholders(ours), b = placeholders(theirs);
  for (const x of b) if (!a.has(x)) out.problems.push(`${p}: unknown placeholder {${x}}`);
  for (const x of a) if (!b.has(x)) out.warnings.push(`${p}: does not use {${x}}`);
}

const countLeaves = (o) => Object.entries(o).reduce((n, [k, v]) =>
  k.startsWith('_') ? n : n + leaves(v), 0);
const leaves = (v) => (isObject(v) ? countLeaves(v) : Array.isArray(v) ? v.reduce((m, x) => m + leaves(x), 0) : 1);

function compare(base, other, path, out) {
  for (const [key, value] of Object.entries(base)) {
    if (key.startsWith('_')) continue;
    const p = path ? `${path}.${key}` : key;
    const theirs = other?.[key];
    if (theirs === undefined || theirs === '') {
      out.missing.push(p);
      out.missingStrings += leaves(value);
    }
    else if (isObject(value)) compare(value, theirs, p, out);
    else if (Array.isArray(value)) {
      if (!Array.isArray(theirs) || theirs.length !== value.length) out.problems.push(`${p}: expected ${value.length} items`);
      else value.forEach((item, i) => {
        if (isObject(item)) compare(item, theirs[i], `${p}[${i}]`, out);
        else if (typeof item === 'string') checkPlaceholders(`${p}[${i}]`, item, theirs[i], out);
      });
    } else if (typeof value === 'string') checkPlaceholders(p, value, theirs, out);
  }
  if (isObject(other)) for (const key of Object.keys(other)) {
    if (!key.startsWith('_') && !(key in base)) out.problems.push(`${path ? `${path}.` : ''}${key}: not in en.json (typo?)`);
  }
}

/** Frontmatter must be valid YAML with a title and a description. */
function checkPage(file) {
  const front = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!front) return `no frontmatter`;
  try {
    const data = parseYaml(front[1]);
    for (const key of ['title', 'description']) if (!data?.[key]) return `frontmatter has no ${key}`;
  } catch (error) {
    return `frontmatter is not valid YAML (${error.message.split('\n')[0]})`;
  }
}

const faqItems = (lang) => parseYaml(readFileSync(join(faqDir, `${lang}.yaml`), 'utf8'))?.items;
const enFaqCount = faqItems('en').length;

/** The FAQ must be valid YAML with as many questions as English, each with a q and an a. */
function checkFaq(lang) {
  try {
    const items = faqItems(lang);
    if (!Array.isArray(items)) return 'no items list';
    if (items.length !== enFaqCount) return `${items.length} items, English has ${enFaqCount}`;
    const bad = items.findIndex((item) => !item?.q || !item?.a);
    if (bad !== -1) return `item ${bad + 1} needs a q and an a`;
  } catch (error) {
    return `not valid YAML (${error.message.split('\n')[0]})`;
  }
}

const total = countLeaves(en);

const requested = process.argv.slice(2);
const langs = readdirSync(uiDir).map((f) => f.replace(/\.json$/, '')).filter((l) => l !== 'en' && (!requested.length || requested.includes(l))).sort();

let failed = false;
for (const lang of langs) {
  const dict = load(lang);
  const out = { missing: [], missingStrings: 0, problems: [], warnings: [] };
  compare(en, dict, '', out);
  const status = dict._status || 'untranslated';
  const done = total - out.missingStrings;
  const pages = pageSlugs.map((slug) => {
    const file = join(pagesDir, lang, `${slug}.md`);
    if (!existsSync(file)) return `✗ ${slug}`;
    const problem = checkPage(file);
    if (problem) out.problems.push(`pages/${lang}/${slug}.md: ${problem}`);
    return problem ? `! ${slug}` : `✓ ${slug}`;
  });
  let faq = '✗ faq';
  if (existsSync(join(faqDir, `${lang}.yaml`))) {
    const problem = checkFaq(lang);
    if (problem) out.problems.push(`faq/${lang}.yaml: ${problem}`);
    faq = problem ? '! faq' : '✓ faq';
  }

  console.log(`\n${lang}  [${status}]  UI ${done}/${total} strings  |  ${[...pages, faq].join('  ')}`);
  for (const p of out.problems) console.log(`  ! ${p}`);
  for (const w of out.warnings) console.log(`  ? ${w}`);
  if (status === 'complete' || requested.length) for (const m of out.missing) console.log(`  - missing ${m}`);
  else if (out.missing.length) console.log(`  (${out.missingStrings} strings fall back to English)`);

  if (status === 'complete' && (out.missing.length || out.problems.length || pages.some((p) => p.startsWith('✗')) || faq.startsWith('✗'))) {
    console.log(`  ✗ marked complete but not finished`);
    failed = true;
  }
  // A file that does not parse breaks the build, whatever the language's status.
  if ([...pages, faq].some((p) => p.startsWith('!'))) failed = true;
}
console.log('');
process.exit(failed ? 1 : 0);
