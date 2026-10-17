const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { countCookbook, landingCountsPlugin, remarkCookbookCounts } = require('./landing-counts.js');

const RUNNABLE_FILES_TABLE = [
  '| File | Description |',
  '|------|-------------|',
  '| [`a.mjs`](https://example.com/a.mjs) | A |',
  '| [`b.mjs`](https://example.com/b.mjs) | B |',
  '| [`c.mjs`](https://example.com/c.mjs) | C |',
].join('\n');
const FOUR_ROW_TABLE = `${RUNNABLE_FILES_TABLE}\n| [\`d.mjs\`](https://example.com/d.mjs) | D |`;

// The shape of agentos's docs/getting-started/EXAMPLES.md as pull-docs copies it in, with code blocks
// that hold a numbered heading and tables, which the page does not render as either.
function examplesPage(runnableFiles = RUNNABLE_FILES_TABLE) {
  return [
    '---',
    'title: "Examples Cookbook"',
    '---',
    '',
    '## Table of Contents',
    '',
    '1. [Customer Service Agency](#1-customer-service-agency)',
    '',
    '## 1. Customer Service Agency',
    '',
    '````markdown',
    '## 2. A heading in a code block',
    '```',
    '| File | Description |',
    '|------|-------------|',
    '| in-a-code-block.mjs | not a row |',
    '````',
    '',
    '## 2. Research Team',
    '',
    '## Runnable Example Files',
    '',
    '```bash',
    '| node | examples/<file>.mjs |',
    '|---|---|',
    '```',
    '',
    runnableFiles,
    '',
    '---',
    '',
    '## Related Guides',
    '',
    '| Guide | What |',
    '|---|---|',
    '| a guide | not a runnable file |',
  ].join('\n');
}

/** A folder for one test's files, removed when the test ends. */
function tempDir(t) {
  // The real path: webpack names a module by the real path of its file, and the macOS temporary
  // folder sits behind a symbolic link.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'landing-counts-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('the cookbook counts are the numbered recipe headings and the rows of the runnable files table', async () => {
  assert.deepEqual(await countCookbook(examplesPage()), { recipes: 2, runnableFiles: 3 });
});

test('a thematic break straight after the runnable files table is not one of its rows', async () => {
  // GFM ends a table at a line that opens another block, so the built page shows three rows.
  assert.deepEqual(await countCookbook(examplesPage(`${RUNNABLE_FILES_TABLE}\n---`)), {
    recipes: 2,
    runnableFiles: 3,
  });
});

test('a line of backticks indented as code opens no fenced block, so the headings after it count', async () => {
  // Four spaces of indent make the line an indented code block.
  const page = examplesPage().replace(
    '## 1. Customer Service Agency\n\n',
    '## 1. Customer Service Agency\n\n    ```\n\n',
  );
  assert.deepEqual(await countCookbook(page), { recipes: 2, runnableFiles: 3 });
});

for (const [what, markdown, message] of [
  ['no numbered recipe heading', examplesPage().replace(/^## \d+\. /gm, '## '), /no numbered recipe heading/],
  [
    'no "Runnable Example Files" heading',
    examplesPage().replace('## Runnable Example Files', '## Example Files'),
    /no "## Runnable Example Files" heading/,
  ],
  [
    'no table in the runnable files section',
    examplesPage('The files are listed on GitHub.'),
    /no table under the "Runnable Example Files" heading/,
  ],
  [
    'a runnable files table with no rows',
    examplesPage(RUNNABLE_FILES_TABLE.split('\n').slice(0, 2).join('\n')),
    /the table under "Runnable Example Files" has no rows/,
  ],
]) {
  test(`a page with ${what} is not counted`, async () => {
    await assert.rejects(async () => countCookbook(markdown), message);
  });
}

test('the landing page takes its counts from the examples page as it reads when the page compiles', async (t) => {
  const dir = tempDir(t);
  const landingPage = path.join(dir, 'index.md');
  const examplesFile = path.join(dir, 'examples.md');
  const other = path.join(dir, 'other', 'index.md');
  fs.writeFileSync(landingPage, '');
  fs.mkdirSync(path.dirname(other));
  fs.writeFileSync(other, '');
  fs.writeFileSync(examplesFile, examplesPage());
  const tree = () => ({
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: '{{examples.recipes}} recipes and a table of {{ examples.runnableFiles }} files in ' },
          { type: 'inlineCode', value: '{{examples.recipes}}' },
        ],
      },
    ],
  });
  const fill = remarkCookbookCounts({ landingPage, examplesPage: examplesFile });

  const first = tree();
  await fill(first, { path: landingPage });
  assert.deepEqual(first.children[0].children, [
    { type: 'text', value: '2 recipes and a table of 3 files in ' },
    { type: 'inlineCode', value: '{{examples.recipes}}' },
  ]);

  // pull-docs rewrites the examples page while a dev server runs: the next compile counts it again.
  fs.writeFileSync(examplesFile, examplesPage(FOUR_ROW_TABLE));
  const second = tree();
  await fill(second, { path: landingPage });
  assert.equal(second.children[0].children[0].value, '2 recipes and a table of 4 files in ');

  // Another page with the same file name keeps its text as written.
  const elsewhere = tree();
  await fill(elsewhere, { path: other });
  assert.deepEqual(elsewhere, tree());
});

test('a placeholder with no value stops the landing page from compiling, with the reason', async (t) => {
  const dir = tempDir(t);
  const landingPage = path.join(dir, 'index.md');
  const examplesFile = path.join(dir, 'examples.md');
  fs.writeFileSync(landingPage, '');
  fs.writeFileSync(examplesFile, examplesPage());
  const page = (value) => ({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value }] }] });

  // A name the plugin does not know.
  await assert.rejects(
    async () =>
      remarkCookbookCounts({ landingPage, examplesPage: examplesFile })(page('{{examples.recipe}} recipes'), {
        path: landingPage,
      }),
    /\{\{examples\.recipe\}\} has no value/,
  );
  // An examples page that is not there.
  await assert.rejects(
    async () =>
      remarkCookbookCounts({ landingPage, examplesPage: path.join(dir, 'missing.md') })(page('{{examples.recipes}} recipes'), {
        path: landingPage,
      }),
    /\{\{examples\.recipes\}\} has no value; cannot count the examples cookbook in .*missing\.md: ENOENT/,
  );
});

test("a changed examples page compiles the landing page again instead of taking it from webpack's cache", async (t) => {
  const webpack = require('webpack');
  const dir = tempDir(t);
  const landingPage = path.join(dir, 'index.md');
  const examplesFile = path.join(dir, 'examples.md');
  const entry = path.join(dir, 'entry.js');
  fs.writeFileSync(landingPage, 'a table of {{examples.runnableFiles}} of the runnable files\n');
  fs.writeFileSync(examplesFile, examplesPage());
  fs.writeFileSync(entry, "module.exports = require('./index.md');\n");
  const { rules } = landingCountsPlugin({}, { landingPage, examplesPage: examplesFile }).configureWebpack().module;

  // One build with a persistent cache in the folder, as a machine that built the site before
  // rebuilds it. Answers whether the build compiled the landing page or took it from the cache.
  const compile = () =>
    new Promise((resolve, reject) => {
      const compiler = webpack({
        mode: 'production',
        context: dir,
        entry,
        output: { path: path.join(dir, 'out') },
        cache: { type: 'filesystem', cacheDirectory: path.join(dir, 'cache') },
        // Content hashes decide whether a file changed, so a rewrite inside the clock's resolution counts.
        snapshot: { module: { hash: true } },
        module: { rules: [...rules, { test: /\.md$/, type: 'asset/source' }] },
        optimization: { minimize: false },
        infrastructureLogging: { level: 'error' },
      });
      compiler.run((runError, stats) => {
        let compiled = false;
        if (!runError && !stats.hasErrors()) {
          const landing = [...stats.compilation.modules].find((module) => module.resource === landingPage);
          compiled = landing !== undefined && stats.compilation.builtModules.has(landing);
        }
        compiler.close((closeError) => {
          if (runError || closeError) reject(runError || closeError);
          else if (stats.hasErrors()) reject(new Error(stats.toString('errors-only')));
          else resolve(compiled);
        });
      });
    });

  assert.equal(await compile(), true, 'the first build compiles the landing page');
  assert.equal(await compile(), false, 'a build with nothing changed takes the landing page from the cache');
  fs.writeFileSync(examplesFile, examplesPage(FOUR_ROW_TABLE));
  assert.equal(await compile(), true, 'a build after the examples page changed compiles the landing page again');
});
