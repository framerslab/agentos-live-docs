#!/usr/bin/env node

/**
 * pull-docs.mjs — Prebuild script that copies markdown from source packages
 * into the Docusaurus docs/ tree, injecting frontmatter and rewriting links.
 *
 * Run: node scripts/pull-docs.mjs
 * Auto-runs via `npm run prebuild` before `npm run build`.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { rewriteMarkdownLinks } from './pull-docs-links.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DOCS_OUT = resolve(ROOT, 'docs');

const MONO_ROOT = resolve(ROOT, '../..');
const EXTENSIONS_GITHUB_REPO = 'https://github.com/framerslab/agentos-extensions';
const require = createRequire(import.meta.url);
const {
  publicationManifest,
  buildFilenameRewriteMap,
  resolvePublicationSourcePath,
} = require('../../../packages/agentos/docs/publication-manifest.cjs');

// ── Link rewrite rules ──────────────────────────────────────────────

/** Map old filename references to new Docusaurus paths */
const linkRewrites = {
  ...buildFilenameRewriteMap(),
  'NESTJS_ARCHITECTURE.md': '/architecture/backend-api',
  'MULTI_GMI_IMPLEMENTATION_PLAN.md': '/architecture/multi-gmi-implementation-plan',
  'MIGRATION_TO_STORAGE_ADAPTER.md': '/features/sql-storage',
  'sandbox-security.md': '/architecture/sandbox-security',
  'cli-subprocess.md': '/architecture/cli-subprocess',
  'tool-permissions.md': '/architecture/tool-permissions',
  'extension-loading.md': '/architecture/extension-loading',
  'skills-engine.md': '/architecture/skills-engine',
};

/** Rewrite curated registry folder links -> docs pages */
const curatedLinkRewrites = Object.fromEntries(
  publicationManifest
    .filter((entry) => entry.sourcePath?.includes('packages/agentos-extensions/registry/curated/'))
    .map((entry) => {
      const curatedDir = entry.sourcePath
        .replace('packages/agentos-extensions/registry/curated/', '')
        .replace(/\/README\.md$/, '');
      return [
        `./registry/curated/${curatedDir}`,
        `/${entry.dest.replace(/\.md$/, '')}`,
      ];
    }),
);

/** Exact-path rewrites that don't fit the filename-only table. */
const exactLinkRewrites = {
  './api/index.html': '/api/',
  './docs/api/index.html': '/api/',
  './security-pipeline.md': '/features/human-in-the-loop',
  '../src/core/tools/ITool.ts': '/api/interfaces/ITool',
  '../src/extensions/ExtensionManager.ts': '/api/classes/ExtensionManager',
  '../../src/core/tools/ITool.ts': '/api/interfaces/ITool',
  '../../src/extensions/ExtensionManager.ts': '/api/classes/ExtensionManager',
};

// ── Helpers ──────────────────────────────────────────────────────────

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function injectFrontmatter(content, title, position) {
  // Extract existing frontmatter if present (yaml block between --- fences)
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n*/);
  const existing = fmMatch ? fmMatch[1] : '';

  // Preserve SEO-relevant frontmatter fields the canonical doc set carries:
  // description (meta-description for search engines + Docusaurus social cards),
  // keywords (meta-keywords array), image (social-card preview image), tags
  // (Docusaurus blog/doc tag system). Fields are passed through verbatim.
  const seoFieldNames = ['description', 'keywords', 'image', 'tags'];
  const preservedSeoLines = [];
  for (const fieldName of seoFieldNames) {
    // Match key followed by `:` and the rest of that line plus any continuation
    // lines (indented or array bullets) until the next top-level key. The
    // negative lookahead at the end stops at a sibling key like `title:` or
    // the end of the frontmatter block.
    const re = new RegExp(`^${fieldName}:[^\n]*(?:\n[ \t-][^\n]*)*`, 'm');
    const match = existing.match(re);
    if (match) {
      preservedSeoLines.push(match[0]);
    }
  }

  // Strip existing frontmatter from the body
  const stripped = content.replace(/^---[\s\S]*?---\n*/, '');

  // Strip leading h1 if it matches the title (Docusaurus uses frontmatter title)
  const withoutH1 = stripped.replace(/^#\s+.*\n+/, '');

  // Pin the guide sidebar to every published guide page so the left nav
  // rail always renders — even when the page is marked `sidebar: false`
  // in publication-manifest.cjs (i.e. excluded from sidebars.js). Without
  // this, Docusaurus renders unlisted pages full-width with no sidebar at
  // all, which breaks layout consistency across the site.
  const frontmatterBody = [
    `title: "${title}"`,
    `sidebar_position: ${position}`,
    `displayed_sidebar: guideSidebar`,
    ...preservedSeoLines,
  ].join('\n');

  return `---\n${frontmatterBody}\n---\n\n${withoutH1}`;
}

function stripBadgeHtml(content) {
  // Remove GitHub badge HTML that renders poorly in Docusaurus
  return content
    .replace(/<p align="center">[\s\S]*?<\/p>/g, '')
    .replace(/\[!\[npm\]\(https:\/\/img\.shields\.io[^\]]*\)\]\([^)]*\)/g, '')
    .replace(/\[!\[GitHub\]\(https:\/\/img\.shields\.io[^\]]*\)\]\([^)]*\)/g, '');
}

function processMarkdown(content, title, position) {
  let result = content;
  result = stripBadgeHtml(result);
  result = rewriteMarkdownLinks(result, { linkRewrites, exactLinkRewrites, curatedLinkRewrites });
  result = injectFrontmatter(result, title, position);
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────

let copied = 0;
let skipped = 0;
const checkMode = process.argv.includes('--check');
const errors = [];
const managedDestinations = new Set(publicationManifest.map((entry) => entry.dest));
const unmanagedRootExclusions = new Set(['api', 'paracosm']);

function syncManagedFile(destPath, content) {
  if (!checkMode) {
    ensureDir(destPath);
    writeFileSync(destPath, content);
    return;
  }

  const current = existsSync(destPath) ? readFileSync(destPath, 'utf8') : null;
  if (current !== content) {
    errors.push(`out-of-date: ${destPath}`);
  }
}

// Helper: when a manifest source can't be resolved (e.g. it lives in a
// repo outside the agentos-live-docs CI checkout), DROP the destination
// instead of writing a placeholder page. The previous behaviour wrote a
// stub that pointed at the monorepo — public docs must not link there.
// If a manifest entry can't resolve, the right fix is to either vendor
// the file under apps/agentos-live-docs/vendored-docs/ or remove the
// manifest entry, not to ship a placeholder.
function writeStub(destPath, title, position, srcHint) {
  if (existsSync(destPath)) {
    rmSync(destPath, { force: true });
  }
  console.warn(`  DROPPED (source not resolvable in this build): ${srcHint}`);
  skipped++;
}

function* walkDocs(dir, prefix = '') {
  if (!existsSync(dir)) return;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = resolve(dir, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      yield* walkDocs(absolute, relative);
      continue;
    }

    if (entry.isFile()) yield relative;
  }
}

function removeUnmanagedDocs() {
  for (const relativePath of walkDocs(DOCS_OUT)) {
    if (!relativePath.endsWith('.md')) continue;
    if (relativePath === 'index.md') continue;

    const rootDir = relativePath.split('/')[0];
    if (unmanagedRootExclusions.has(rootDir)) continue;
    if (managedDestinations.has(relativePath)) continue;

    const absolutePath = resolve(DOCS_OUT, relativePath);
    if (checkMode) {
      errors.push(`orphaned: ${absolutePath}`);
    } else {
      rmSync(absolutePath, { force: true });
    }
  }
}

for (const { sourcePath, dest, title, position, sourceType } of publicationManifest) {
  const destPath = resolve(DOCS_OUT, dest);
  const resolved = resolvePublicationSourcePath(MONO_ROOT, { sourcePath, sourceType });

  if (!resolved) {
    if (sourceType === 'generated-stub') {
      const curatedDir = sourcePath
        .replace('packages/agentos-extensions/registry/curated/', '')
        .replace(/\/README\.md$/, '');
      syncManagedFile(
        destPath,
        `---
title: "${title}"
sidebar_position: ${position}
---

# ${title}

Documentation coming soon. See the [extension source](https://github.com/framerslab/agentos-extensions/tree/master/registry/curated/${curatedDir}) for usage details.
`,
      );
      console.warn(`  STUB (no README): ${curatedDir}`);
      skipped++;
      continue;
    }

    writeStub(destPath, title, position, sourcePath);
    continue;
  }

  let content = readFileSync(resolved, 'utf8');
  if (sourcePath.includes('packages/agentos-extensions/registry/curated/')) {
    const curatedDir = sourcePath
      .replace('packages/agentos-extensions/registry/curated/', '')
      .replace(/\/README\.md$/, '');
    content = content.replace(/\[([^\]]+)\]\(\.\/examples\/?\)/g, (_match, label) => {
      const url = `${EXTENSIONS_GITHUB_REPO}/tree/master/registry/curated/${curatedDir}/examples`;
      return `[${label}](${url})`;
    });
  }

  syncManagedFile(destPath, processMarkdown(content, title, position));
  copied++;
}

removeUnmanagedDocs();

// 6. Create api/index.md stub (TypeDoc overwrites it during build, but we
//    need a placeholder so sidebars.js doesn't break on dev/pre-build).
const apiIndexPath = resolve(DOCS_OUT, 'api/index.md');
if (!existsSync(apiIndexPath)) {
  syncManagedFile(
    apiIndexPath,
    `---
title: "API Reference"
sidebar_position: 1
---

# API Reference

Auto-generated TypeDoc API reference for the \`@framers/agentos\` package.

> **Note:** The full API reference is generated during the build step via
> [docusaurus-plugin-typedoc](https://www.npmjs.com/package/docusaurus-plugin-typedoc).
> If you are viewing a local development build, run \`npm run build\` to generate
> the complete API docs.
`,
  );
  console.log('  Created api/index.md stub');
}

if (checkMode && errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
}

console.log(`\npull-docs: ${copied} files copied, ${skipped} skipped/stubbed`);
