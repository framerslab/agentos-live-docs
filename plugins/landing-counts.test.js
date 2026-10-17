const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { countCookbook, cookbookPlaceholders, remarkFillPlaceholders } = require('./landing-counts.js');

const RUNNABLE_FILES_TABLE = [
  '| File | Description |',
  '|------|-------------|',
  '| [`a.mjs`](https://example.com/a.mjs) | A |',
  '| [`b.mjs`](https://example.com/b.mjs) | B |',
  '| [`c.mjs`](https://example.com/c.mjs) | C |',
].join('\n');

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

test('the cookbook counts are the numbered recipe headings and the rows of the runnable files table', () => {
  assert.deepEqual(countCookbook(examplesPage()), { recipes: 2, runnableFiles: 3 });
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
  test(`a page with ${what} is not counted`, () => {
    assert.throws(() => countCookbook(markdown), message);
  });
}

test('the placeholder values are counted in the examples page, or say why they are missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-counts-'));
  try {
    const page = path.join(dir, 'examples.md');
    fs.writeFileSync(page, examplesPage());
    assert.deepEqual(cookbookPlaceholders(page), {
      values: { 'examples.recipes': 2, 'examples.runnableFiles': 3 },
      problem: null,
    });

    const missing = cookbookPlaceholders(path.join(dir, 'missing.md'));
    assert.deepEqual(missing.values, {});
    assert.match(missing.problem, /^cannot count the examples cookbook in .*missing\.md: ENOENT/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the plugin fills the placeholders of its own page and stops on one with no value', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-counts-'));
  try {
    const landing = path.join(dir, 'index.md');
    const other = path.join(dir, 'other', 'index.md');
    fs.writeFileSync(landing, '');
    fs.mkdirSync(path.dirname(other));
    fs.writeFileSync(other, '');
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
    const fill = remarkFillPlaceholders({
      file: landing,
      values: { 'examples.recipes': 17, 'examples.runnableFiles': 23 },
    });

    const filled = tree();
    fill(filled, { path: landing });
    assert.deepEqual(filled.children[0].children, [
      { type: 'text', value: '17 recipes and a table of 23 files in ' },
      { type: 'inlineCode', value: '{{examples.recipes}}' },
    ]);

    // Another page with the same file name keeps its text as written.
    const elsewhere = tree();
    fill(elsewhere, { path: other });
    assert.deepEqual(elsewhere, tree());

    // A placeholder the values do not name stops the build, with the reason they are missing.
    const unread = remarkFillPlaceholders({ file: landing, values: {}, problem: 'cannot count the examples cookbook' });
    assert.throws(
      () => unread(tree(), { path: landing }),
      /\{\{examples\.recipes\}\} has no value; cannot count the examples cookbook/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
