/**
 * @fileoverview The counts the documentation landing page gives of the examples cookbook.
 *
 * docs/index.md writes them as `{{examples.recipes}}` and `{{examples.runnableFiles}}`.
 * docusaurus.config.ts counts the examples page that pull-docs copied in from agentos when the
 * config loads, and remarkFillPlaceholders puts the numbers in when the landing page compiles. A
 * count typed into the page goes stale: the landing page said 22 runnable files while the examples
 * page listed 23.
 *
 * The numbers reach the plugin as its options, not by a read of the examples page while the page
 * compiles: the docs plugin writes its options into a file every docs page depends on, so a changed
 * count recompiles the landing page instead of serving it from webpack's persistent cache.
 */

const fs = require('fs');
const path = require('path');

// A fence opens with three or more backticks or tildes, and a backtick fence's info string holds no
// backtick. A fence inside a list item is indented, so a fence is read at any indentation.
const FENCE_RE = /^\s*(`{3,}|~{3,})(.*)$/;
// A table's delimiter row: cells of dashes, each with optional colons, between pipes.
const DELIMITER_RE = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const HEADING_RE = /^ {0,3}#{1,6}(?:[ \t]|$)/;
// The next heading of level 1 or 2 ends a section that a level-2 heading opened.
const SECTION_END_RE = /^ {0,3}#{1,2}(?:[ \t]|$)/;
const RECIPE_RE = /^ {0,3}##[ \t]+\d+\.[ \t]/;
const RUNNABLE_FILES_RE = /^ {0,3}##[ \t]+Runnable Example Files[ \t]*#*[ \t]*$/;
const PLACEHOLDER_RE = /\{\{([^{}]*)\}\}/g;

/** For each line, whether it belongs to a fenced code block, the fences included. */
function fencedLines(lines) {
  const fenced = [];
  let open = null;
  for (const line of lines) {
    const fence = FENCE_RE.exec(line);
    if (open) {
      fenced.push(true);
      // A closing fence repeats the opening character, at least as many times, with nothing after it.
      if (fence && fence[1][0] === open[0] && fence[1].length >= open.length && fence[2].trim() === '') {
        open = null;
      }
    } else if (fence && !(fence[1][0] === '`' && fence[2].includes('`'))) {
      fenced.push(true);
      open = fence[1];
    } else {
      fenced.push(false);
    }
  }
  return fenced;
}

/**
 * Counts the examples cookbook in the Markdown of its page, skipping fenced code blocks.
 *
 * @param {string} markdown the examples page
 * @returns {{ recipes: number, runnableFiles: number }} the headings numbered `## 1. `, `## 2. ` and
 *   on, and the body rows of the first table in the "Runnable Example Files" section
 * @throws {Error} when the page has no numbered recipe heading, no "Runnable Example Files" heading,
 *   or no table with a row in that section
 */
function countCookbook(markdown) {
  const lines = markdown.split(/\r?\n/);
  const fenced = fencedLines(lines);
  const isText = (index) => index < lines.length && !fenced[index];

  const recipes = lines.filter((line, index) => isText(index) && RECIPE_RE.test(line)).length;
  if (recipes === 0) {
    throw new Error('no numbered recipe heading (## 1. ...)');
  }

  const heading = lines.findIndex((line, index) => isText(index) && RUNNABLE_FILES_RE.test(line));
  if (heading === -1) {
    throw new Error('no "## Runnable Example Files" heading');
  }

  for (let index = heading + 1; index < lines.length; index += 1) {
    if (!isText(index)) continue;
    if (SECTION_END_RE.test(lines[index])) break;
    // A table opens with a header row and, on the next line, its delimiter row.
    const next = index + 1;
    if (!lines[index].includes('|') || !isText(next) || !lines[next].includes('|') || !DELIMITER_RE.test(lines[next])) {
      continue;
    }
    // Its body rows run to the first blank line, heading or code block.
    let rows = 0;
    for (let row = next + 1; isText(row) && lines[row].trim() !== '' && !HEADING_RE.test(lines[row]); row += 1) {
      rows += 1;
    }
    if (rows === 0) {
      throw new Error('the table under "Runnable Example Files" has no rows');
    }
    return { recipes, runnableFiles: rows };
  }
  throw new Error('no table under the "Runnable Example Files" heading');
}

/**
 * The values of the landing page's cookbook placeholders, counted in the examples page.
 *
 * @param {string} examplesPage the examples page pull-docs copied in
 * @returns {{ values: Record<string, number>, problem: string | null }} the two counts; when the
 *   page cannot be read or counted, no values and the reason, which remarkFillPlaceholders reports
 *   if the landing page compiles
 */
function cookbookPlaceholders(examplesPage) {
  try {
    const { recipes, runnableFiles } = countCookbook(fs.readFileSync(examplesPage, 'utf8'));
    return { values: { 'examples.recipes': recipes, 'examples.runnableFiles': runnableFiles }, problem: null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      values: {},
      problem:
        `cannot count the examples cookbook in ${examplesPage}: ${reason}. ` +
        "npm run pull-docs copies that page in from agentos's docs/getting-started/EXAMPLES.md.",
    };
  }
}

function realPath(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

/** Calls `visit` with every text node under `node`. */
function eachText(node, visit) {
  if (node.type === 'text') visit(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) eachText(child, visit);
  }
}

/**
 * A remark plugin that fills the `{{name}}` placeholders in the text of one Markdown file. A
 * placeholder with no value stops the build, so the page never shows one.
 *
 * @param {object} options
 * @param {string} options.file the Markdown file whose placeholders it fills
 * @param {Record<string, string | number>} options.values the value of each placeholder, by name
 * @param {string | null} [options.problem] why the values could not be read, given in the error
 * @returns {(tree: object, vfile: { path?: string }) => void}
 */
function remarkFillPlaceholders({ file, values, problem = null }) {
  const target = realPath(file);
  return (tree, vfile) => {
    if (!vfile.path || path.basename(vfile.path) !== path.basename(file) || realPath(vfile.path) !== target) {
      return;
    }
    eachText(tree, (node) => {
      node.value = node.value.replace(PLACEHOLDER_RE, (placeholder, name) => {
        const key = name.trim();
        if (Object.prototype.hasOwnProperty.call(values, key)) return String(values[key]);
        throw new Error(`[landing-counts] ${file}: ${placeholder} has no value${problem ? `; ${problem}` : ''}`);
      });
    });
  };
}

module.exports = { countCookbook, cookbookPlaceholders, remarkFillPlaceholders };
