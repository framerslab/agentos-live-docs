/**
 * @fileoverview The counts the documentation landing page gives of the examples cookbook.
 *
 * docs/index.md writes them as `{{examples.recipes}}` and `{{examples.runnableFiles}}`. When the
 * landing page compiles, remarkCookbookCounts counts the examples page that pull-docs copied in
 * from agentos and puts the numbers in. A count typed into the page goes stale each time agentos
 * adds a recipe or an example file.
 *
 * countCookbook reads the examples page with the Markdown parser the build reads a .md page with,
 * so it counts the headings and table rows the built page shows. landingCountsPlugin makes the
 * examples page a webpack dependency of the landing page: when the examples page changes, a running
 * dev server compiles the landing page again, and a build does not serve the landing page from
 * webpack's persistent cache.
 */

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');

// The placeholders the landing page can hold, each with the count it stands for.
const PLACEHOLDERS = new Map([
  ['examples.recipes', 'recipes'],
  ['examples.runnableFiles', 'runnableFiles'],
]);
const PLACEHOLDER_RE = /\{\{([^{}]*)\}\}/g;
const HAS_PLACEHOLDER_RE = /\{\{[^{}]*\}\}/;
const RECIPE_RE = /^\d+\.\s/;
const RUNNABLE_FILES = 'Runnable Example Files';

let parserPromise;

/**
 * The parser Docusaurus's Markdown loader reads a .md page with: its preprocessing (mdx-code-block
 * fences unwrapped, `{#id}` heading ids escaped, `:::note Title` admonitions given a label), then
 * remark-parse with the front matter, directive, GFM and comment syntax the loader adds, in its
 * order. The packages are the copies the loader resolves. The settings are the site's: Docusaurus's
 * defaults for `markdown.mdx1Compat`, which docusaurus.config.ts leaves as they are, and admonitions
 * on, as the docs plugin has them.
 *
 * A failed load is not kept, so the next count tries again (a running dev server recovers once the
 * packages are installed).
 *
 * @returns {Promise<(markdown: string) => object>} a function that parses Markdown into an mdast tree
 */
function markdownParser() {
  parserPromise ??= loadMarkdownParser().catch((err) => {
    parserPromise = undefined;
    throw err;
  });
  return parserPromise;
}

async function loadMarkdownParser() {
  const fromLoader = createRequire(require.resolve('@docusaurus/mdx-loader'));
  const fromMdx = createRequire(fromLoader.resolve('@mdx-js/mdx'));
  // The parser packages are ES modules, which a CommonJS module reaches through a dynamic load.
  const load = (from, name) => import(pathToFileURL(from.resolve(name)).href);
  const [{ unified }, remarkParse, remarkFrontmatter, remarkDirective, remarkGfm, remarkComment] =
    await Promise.all([
      load(fromLoader, 'unified'),
      load(fromMdx, 'remark-parse'),
      load(fromLoader, 'remark-frontmatter'),
      load(fromLoader, 'remark-directive'),
      load(fromLoader, 'remark-gfm'),
      load(fromLoader, '@slorber/remark-comment'),
    ]);
  const preprocess = fromLoader('@docusaurus/mdx-loader/lib/preprocessor').default;
  const processor = unified()
    .use(remarkParse.default)
    .use(remarkFrontmatter.default)
    .use(remarkDirective.default)
    .use(remarkGfm.default)
    .use(remarkComment.default)
    .freeze();
  const markdownConfig = { mdx1Compat: { comments: true, admonitions: true, headingIds: true } };
  return (markdown) =>
    processor.parse(preprocess({ fileContent: markdown, filePath: 'examples.md', markdownConfig, admonitions: true }));
}

/** The text of a node and of everything under it. */
function textOf(node) {
  if (typeof node.value === 'string') return node.value;
  return Array.isArray(node.children) ? node.children.map(textOf).join('') : '';
}

/** A heading's text, without the `{#custom-id}` Docusaurus reads off its end. */
function headingText(node) {
  return textOf(node)
    .replace(/\s*\\?\{#[^}]*\\?\}\s*$/, '')
    .trim();
}

function isHeading(node, depth) {
  return node.type === 'heading' && node.depth === depth;
}

/**
 * Counts the examples cookbook on its page.
 *
 * @param {string} markdown the examples page, as pull-docs wrote it
 * @returns {Promise<{ recipes: number, runnableFiles: number }>} the level-2 headings numbered
 *   `1. `, `2. ` and on, and the body rows of the first table after the "Runnable Example Files"
 *   heading and before the next heading of level 1 or 2
 * @throws {Error} the promise rejects when the page has no numbered recipe heading, no "Runnable
 *   Example Files" heading, or no table with a body row in that section
 */
async function countCookbook(markdown) {
  const parse = await markdownParser();
  // Every node of the page in document order: a heading or table inside a list, a quote or an
  // admonition renders as one too.
  const nodes = [];
  const walk = (node) => {
    nodes.push(node);
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(parse(markdown));

  const recipes = nodes.filter((node) => isHeading(node, 2) && RECIPE_RE.test(headingText(node))).length;
  if (recipes === 0) {
    throw new Error('no numbered recipe heading (## 1. ...)');
  }

  const heading = nodes.findIndex((node) => isHeading(node, 2) && headingText(node) === RUNNABLE_FILES);
  if (heading === -1) {
    throw new Error(`no "## ${RUNNABLE_FILES}" heading`);
  }
  for (const node of nodes.slice(heading + 1)) {
    if (node.type === 'heading' && node.depth <= 2) break;
    if (node.type === 'table') {
      // The first row of a table is its header row.
      const runnableFiles = node.children.length - 1;
      if (runnableFiles < 1) {
        throw new Error(`the table under "${RUNNABLE_FILES}" has no rows`);
      }
      return { recipes, runnableFiles };
    }
  }
  throw new Error(`no table under the "${RUNNABLE_FILES}" heading`);
}

function realPath(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

/** Calls `visit` with every text node under `node`. Code, inline code and HTML are not text nodes. */
function eachText(node, visit) {
  if (node.type === 'text') visit(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) eachText(child, visit);
  }
}

/**
 * A remark plugin for the documentation landing page. Each time the page compiles, it counts the
 * examples page and puts the counts in place of the placeholders in the page's text; a placeholder
 * in code stays as written. A placeholder it has no value for stops the build and says why, so the
 * page never shows one. It changes no other page. docusaurus.config.ts runs it before Docusaurus's
 * own remark plugins, which build the headings' anchors and the table of contents from the text it
 * leaves.
 *
 * @param {object} options
 * @param {string} options.landingPage the landing page, docs/index.md
 * @param {string} options.examplesPage the examples page that pull-docs copies in
 * @returns {(tree: object, vfile: { path?: string }) => Promise<void>}
 */
function remarkCookbookCounts({ landingPage, examplesPage }) {
  const target = realPath(landingPage);
  return async (tree, vfile) => {
    if (!vfile.path || path.basename(vfile.path) !== path.basename(landingPage) || realPath(vfile.path) !== target) {
      return;
    }
    const texts = [];
    eachText(tree, (node) => {
      if (HAS_PLACEHOLDER_RE.test(node.value)) texts.push(node);
    });
    if (texts.length === 0) return;

    let counts = null;
    let problem = '';
    try {
      counts = await countCookbook(await fs.promises.readFile(examplesPage, 'utf8'));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      problem =
        `; cannot count the examples cookbook in ${examplesPage}: ${reason}. ` +
        "npm run pull-docs copies that page in from agentos's docs/getting-started/EXAMPLES.md.";
    }
    const known = [...PLACEHOLDERS.keys()].map((name) => `{{${name}}}`).join(' and ');
    for (const node of texts) {
      node.value = node.value.replace(PLACEHOLDER_RE, (placeholder, name) => {
        const count = PLACEHOLDERS.get(name.trim());
        if (count === undefined) {
          throw new Error(`[landing-counts] ${landingPage}: ${placeholder} has no value; the placeholders are ${known}`);
        }
        if (counts === null) {
          throw new Error(`[landing-counts] ${landingPage}: ${placeholder} has no value${problem}`);
        }
        return String(counts[count]);
      });
    }
  };
}

/**
 * A Docusaurus plugin that makes the examples page a webpack dependency of the landing page, through
 * landing-counts-loader.js. remarkCookbookCounts reads the examples page while the landing page
 * compiles, a read webpack does not see; without the dependency, a changed examples page would
 * leave the landing page as it was, in a running dev server and in a build that serves the landing
 * page from webpack's persistent cache.
 *
 * @param {object} _context Docusaurus's load context, not read
 * @param {object} options
 * @param {string} options.landingPage the landing page, docs/index.md
 * @param {string} options.examplesPage the examples page that pull-docs copies in
 */
function landingCountsPlugin(_context, { landingPage, examplesPage }) {
  // webpack names a module by the real path of its file.
  const landing = new Set([path.resolve(landingPage), realPath(landingPage)]);
  return {
    name: 'landing-counts',
    configureWebpack() {
      return {
        module: {
          rules: [
            {
              test: (resource) => landing.has(resource),
              enforce: 'pre',
              use: [{ loader: require.resolve('./landing-counts-loader.js'), options: { examplesPage } }],
            },
          ],
        },
      };
    },
  };
}

module.exports = { countCookbook, landingCountsPlugin, remarkCookbookCounts };
