import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Checks the pages `npm run build` writes to build/, the files the deploy publishes. Run it after a
// build: `npm run test:built`.

const BUILD = resolve(dirname(fileURLToPath(import.meta.url)), '../build');
const require = createRequire(import.meta.url);
const { stripTags } = require('../plugins/search-manifest.js');

/** The HTML inside a built page's <article>, the page's own content. */
function builtArticle(route) {
  // trailingSlash is false in docusaurus.config.ts, so the build writes the route /a/b to build/a/b.html.
  const file = resolve(BUILD, `${route.replace(/^\//, '')}.html`);
  assert.ok(existsSync(file), `${file} is missing; run npm run build first`);
  const article = readFileSync(file, 'utf8').match(/<article\b[^>]*>([\s\S]*?)<\/article>/);
  assert.ok(article, `${file} has no <article>`);
  return article[1];
}

test("the landing page's cookbook counts are the examples page's", () => {
  const examples = builtArticle('/getting-started/examples');

  // The recipes are the headings numbered "1. ", "2. " and on.
  const recipes = [...examples.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)]
    .map(([, inner]) => stripTags(inner))
    .filter((text) => /^\d+\.\s/.test(text)).length;
  assert.ok(recipes > 0, 'the examples page has no numbered recipe heading');

  // The runnable files are the body rows of the table under the "Runnable Example Files" heading.
  const heading = examples.search(/<h2\b[^>]*\bid="runnable-example-files"/);
  assert.notEqual(heading, -1, 'the examples page has no "Runnable Example Files" heading');
  const table = examples.slice(heading).match(/<table\b[\s\S]*?<\/table>/);
  assert.ok(table, 'no table follows the "Runnable Example Files" heading');
  const runnableFiles = (table[0].match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1].match(/<tr\b/g) ?? []).length;
  assert.ok(runnableFiles > 0, 'the "Runnable Example Files" table has no rows');

  const landing = stripTags(builtArticle('/documentation'));
  // A count written by hand went stale here: the page said 22 runnable files while the table listed 23.
  const sentence = landing.match(/Examples Cookbook\W+(\S+) recipes for\b.*?\ba table of (\S+) of the runnable files\b/);
  assert.ok(sentence, 'the landing page has no examples cookbook sentence');
  assert.deepEqual(
    { recipes: sentence[1], runnableFiles: sentence[2] },
    { recipes: String(recipes), runnableFiles: String(runnableFiles) },
  );
  assert.doesNotMatch(landing, /\{\{[^}]*\}\}/, 'the landing page shows a {{...}} placeholder');
});

test('no built page loads Google Analytics or Clarity before a choice, and every page offers the choices', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const pages = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.html')) pages.push(path);
    }
  };
  walk(BUILD);
  assert.ok(pages.length > 0, 'the build wrote no pages; run npm run build first');
  const loadsVendor = [];
  const missingChoices = [];
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    // Redirect stubs from plugin-client-redirects carry no layout.
    if (!/<div id="__docusaurus"/.test(html)) continue;
    if (/googletagmanager\.com\/gtag|clarity\.ms\/tag|gtag\(\s*['"]config/.test(html)) loadsVendor.push(page);
    if (!/<script[^>]+src="\/consent\/consent\.js"/.test(html)) missingChoices.push(page);
  }
  assert.deepEqual(loadsVendor, [], 'these pages load a vendor before any choice');
  assert.deepEqual(missingChoices, [], 'these pages do not load the analytics choices');
});
