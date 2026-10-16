import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MONO_ROOT = resolve(ROOT, '..');
const require = createRequire(import.meta.url);

test('publication manifest exists and canonicalizes the skills section', () => {
  const manifestPath = resolve(MONO_ROOT, 'packages/agentos/docs/publication-manifest.cjs');
  assert.equal(existsSync(manifestPath), true);

  const { publicationManifest } = require(manifestPath);
  const byDestination = new Map(publicationManifest.map((entry) => [entry.dest, entry]));

  assert.equal(byDestination.has('skills/index.md'), true);
  assert.equal(
    byDestination.get('skills/index.md')?.sourcePath,
    'packages/agentos/docs/SKILLS_OVERVIEW.md',
  );
  assert.equal(byDestination.has('skills/agentos-skills.md'), true);
  assert.equal(byDestination.has('skills/skills-extension.md'), false);
  assert.equal(byDestination.has('extensions/index.md'), true);
  assert.equal(
    byDestination.get('extensions/index.md')?.sourcePath,
    'packages/agentos-extensions/README.md',
  );
});

test('publication inventory rejects duplicate destinations and missing sources', () => {
  const manifestPath = resolve(MONO_ROOT, 'packages/agentos/docs/publication-manifest.cjs');
  const { buildPublicationInventory } = require(manifestPath);
  const inventory = buildPublicationInventory(MONO_ROOT);

  assert.deepEqual(inventory.duplicates, []);
  assert.deepEqual(inventory.missingSources, []);
  assert.equal(inventory.generatedDestinations.includes('getting-started/high-level-api.md'), true);
});

test('publication manifest covers the full public docs surface, including static and built-in pages', () => {
  const manifestPath = resolve(MONO_ROOT, 'packages/agentos/docs/publication-manifest.cjs');
  const { publicationManifest } = require(manifestPath);
  const byDestination = new Map(publicationManifest.map((entry) => [entry.dest, entry]));

  assert.equal(
    byDestination.get('architecture/skills-vs-tools-vs-extensions.md')?.sourcePath,
    'apps/agentos-live-docs/docs/architecture/skills-vs-tools-vs-extensions.md',
  );
  assert.equal(
    byDestination.get('features/video-pipeline.md')?.sourcePath,
    'apps/agentos-live-docs/static-docs/features/video-pipeline.md',
  );
  assert.equal(
    byDestination.get('features/llm-output-validation.md')?.sourcePath,
    'apps/agentos-live-docs/docs/features/llm-output-validation.md',
  );
  assert.equal(
    byDestination.get('extensions/built-in/code-safety.md')?.sourcePath,
    'apps/agentos-live-docs/static-docs/extensions/built-in/code-safety.md',
  );
  assert.equal(byDestination.has('extensions/built-in/content-policy-rewriter.md'), true);
  assert.equal(byDestination.has('extensions/built-in/local-file-search.md'), true);
});

test('publication inventory script resolves the monorepo root correctly', () => {
  execFileSync('node', ['packages/agentos/scripts/build-publication-inventory.mjs'], {
    cwd: MONO_ROOT,
    stdio: 'pipe',
  });
});

test('guide sidebar is derived from the canonical manifest', () => {
  const manifestPath = resolve(MONO_ROOT, 'packages/agentos/docs/publication-manifest.cjs');
  const { buildGuideSidebar } = require(manifestPath);
  const items = buildGuideSidebar();
  const serialized = JSON.stringify(items);

  assert.match(serialized, /skills\/agentos-skills/);
  assert.doesNotMatch(serialized, /skills\/skills-extension/);
  assert.match(serialized, /getting-started\/high-level-api/);
  assert.match(serialized, /Official Extensions/);
  assert.match(serialized, /extensions\/built-in\/code-safety/);
  assert.match(serialized, /features\/video-pipeline/);
  assert.match(serialized, /architecture\/skills-vs-tools-vs-extensions/);
});

test('pull-docs publishes the canonical skills content routes', () => {
  execFileSync('node', ['scripts/pull-docs.mjs'], {
    cwd: resolve(MONO_ROOT, 'apps/agentos-live-docs'),
    stdio: 'pipe',
  });

  assert.equal(
    existsSync(resolve(MONO_ROOT, 'apps/agentos-live-docs/docs/skills/agentos-skills.md')),
    true,
  );
  assert.equal(
    existsSync(resolve(MONO_ROOT, 'apps/agentos-live-docs/docs/skills/skills-extension.md')),
    false,
  );
  assert.equal(
    existsSync(resolve(MONO_ROOT, 'apps/agentos-live-docs/docs/extensions/built-in/code-safety.md')),
    true,
  );
  assert.equal(
    existsSync(resolve(MONO_ROOT, 'apps/agentos-live-docs/docs/superpowers/specs/2026-04-14-skills-vs-tools-vs-extensions-design.md')),
    false,
  );
});

test('public docs tree has no unmanaged markdown after sync', () => {
  const manifestPath = resolve(MONO_ROOT, 'packages/agentos/docs/publication-manifest.cjs');
  const { publicationManifest } = require(manifestPath);
  const docsRoot = resolve(MONO_ROOT, 'apps/agentos-live-docs/docs');
  const managed = new Set(publicationManifest.map((entry) => entry.dest));
  const orphans = [];

  execFileSync('node', ['scripts/pull-docs.mjs'], {
    cwd: resolve(MONO_ROOT, 'apps/agentos-live-docs'),
    stdio: 'pipe',
  });

  function walk(dir, prefix = '') {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = resolve(dir, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walk(absolute, relative);
        continue;
      }

      if (!entry.isFile() || !relative.endsWith('.md')) continue;
      if (relative === 'index.md') continue;

      const root = relative.split('/')[0];
      if (root === 'api' || root === 'paracosm') continue;
      if (!managed.has(relative)) orphans.push(relative);
    }
  }

  walk(docsRoot);
  assert.deepEqual(orphans.sort(), []);
});

test('a pull leaves no untracked file under docs/', () => {
  const siteRoot = resolve(MONO_ROOT, 'apps/agentos-live-docs');

  execFileSync('node', ['scripts/pull-docs.mjs'], { cwd: siteRoot, stdio: 'pipe' });

  // .gitignore keeps the pages pull-docs copies in out of `git status`. A folder it does not
  // cover shows up as untracked after every local build: docs/text/ did when the manifest
  // added its section.
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'docs'], {
    cwd: siteRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);

  assert.deepEqual(untracked, []);
});

test("the landing page's tests badge reads the count agentos's release publishes", () => {
  const landing = readFileSync(resolve(MONO_ROOT, 'apps/agentos-live-docs/docs/index.md'), 'utf8');

  // A count typed into a static shields.io badge goes stale. In October 2026 this page's badge
  // said "9,300+ passed" while the count agentos's release writes said "10,500+". The release
  // refreshes .github/badges/tests.json and ships it in the package; agentos's README reads it
  // through unpkg, since shields.io refuses github.com addresses.
  const testsBadges = [...landing.matchAll(/\[!\[tests\]\(([^)\s]+)\)\]\(([^)\s]+)\)/gi)];
  assert.equal(testsBadges.length, 1);
  const [, source, target] = testsBadges[0];
  const image = new URL(source);
  assert.equal(`${image.origin}${image.pathname}`, 'https://img.shields.io/endpoint');
  assert.equal(image.searchParams.get('url'), 'https://unpkg.com/@framers/agentos@latest/.github/badges/tests.json');
  // Parameters that change how the badge looks; none of them changes the count it shows.
  const looks = new Set(['url', 'style', 'logo', 'logoColor', 'logoSize', 'labelColor', 'color', 'cacheSeconds']);
  assert.deepEqual([...image.searchParams.keys()].filter((key) => !looks.has(key)), []);
  assert.equal(target, 'https://github.com/framerslab/agentos/actions/workflows/ci.yml');

  // No other badge on the page types a test or coverage figure, in either static form shields.io
  // serves: /badge/<label>-<message>-<color> and /static/v1?label=<label>&message=<message>.
  const typed = [...landing.matchAll(/https:\/\/img\.shields\.io\/[^\s)"'<>]+/g)]
    .map(([address]) => new URL(address.replaceAll('&amp;', '&')))
    .filter(
      (address) =>
        (address.pathname.startsWith('/badge/') && !address.pathname.startsWith('/badge/dynamic/')) ||
        address.pathname.startsWith('/static/'),
    )
    .filter((address) => /\b(?:tests?|coverage)\b/i.test(decodeURIComponent(`${address.pathname} ${address.search}`)))
    .map(String);
  assert.deepEqual(typed, []);
});

test('pull-docs check mode detects stale generated docs', () => {
  const docsRoot = resolve(MONO_ROOT, 'apps/agentos-live-docs/docs');
  const target = resolve(docsRoot, 'skills/agentos-skills.md');
  const original = readFileSync(target, 'utf8');

  writeFileSync(target, `${original}\n<!-- drift -->\n`);

  try {
    assert.throws(() => {
      execFileSync('node', ['scripts/pull-docs.mjs', '--check'], {
        cwd: resolve(MONO_ROOT, 'apps/agentos-live-docs'),
        stdio: 'pipe',
      });
    });
  } finally {
    writeFileSync(target, original);
  }
});

test('publication verification scripts are wired into the docs packages', () => {
  const liveDocsPackage = require(resolve(MONO_ROOT, 'apps/agentos-live-docs/package.json'));
  const agentosPackage = require(resolve(MONO_ROOT, 'packages/agentos/package.json'));
  const docusaurusConfig = readFileSync(resolve(MONO_ROOT, 'apps/agentos-live-docs/docusaurus.config.ts'), 'utf8');

  assert.equal(
    liveDocsPackage.scripts['test:publication'],
    'node --test scripts/publication-contract.test.mjs scripts/pull-docs-links.test.mjs plugins/search-manifest.test.js plugins/github-stars.test.js',
  );
  assert.equal(
    liveDocsPackage.scripts['verify:publication'],
    'AGENTOS_DOCS_STRICT=1 npm run test:publication && AGENTOS_DOCS_STRICT=1 node scripts/pull-docs.mjs --check && AGENTOS_DOCS_STRICT=1 npm run build',
  );
  assert.equal(
    liveDocsPackage.scripts['build:guides'],
    'AGENTOS_DOCS_GUIDES_ONLY=1 AGENTOS_DOCS_DISABLE_LOCAL_SEARCH=1 AGENTOS_DOCS_DISABLE_SEARCH_MANIFEST=1 AGENTOS_DOCS_STRICT=0 npm run build',
  );
  assert.equal(
    liveDocsPackage.scripts['start:guides'],
    'AGENTOS_DOCS_GUIDES_ONLY=1 AGENTOS_DOCS_DISABLE_LOCAL_SEARCH=1 AGENTOS_DOCS_DISABLE_SEARCH_MANIFEST=1 AGENTOS_DOCS_STRICT=0 npm run start',
  );
  assert.equal(
    agentosPackage.scripts['docs:verify'],
    'node scripts/build-publication-inventory.mjs && pnpm --dir ../../ --filter @framers/agentos-live-docs run verify:publication && npx vitest run src/api/runtime/__tests__/docs-alignment.test.ts',
  );
  assert.match(docusaurusConfig, /AGENTOS_DOCS_GUIDES_ONLY/);
  assert.match(docusaurusConfig, /exclude:\s*guidesOnly\s*\?\s*\['api\/\*\*',\s*'paracosm\/\*\*'\]\s*:\s*\[\]/);
  // Blog consolidation (Track G, 2026-04-30): canonical blog moved to
  // agentos.sh/en/blog. The local blog plugin is disabled unconditionally,
  // and the navbar "Blog" entry is an external href under guidesOnly.
  assert.match(docusaurusConfig, /blog:\s*false,/);
  assert.match(
    docusaurusConfig,
    /\.\.\.\(!guidesOnly[\s\S]*?\[\s*\{[\s\S]*?href:\s*'https:\/\/agentos\.sh\/en\/blog'[\s\S]*?label:\s*'Blog'/,
  );
  assert.match(docusaurusConfig, /label: 'Skills',\s*to: '\/skills'/);
  assert.match(docusaurusConfig, /label: 'Extensions',\s*to: '\/extensions'/);
  assert.match(docusaurusConfig, /label: 'Text Processing & Search',\s*to: '\/text'/);
  assert.match(docusaurusConfig, /from: '\/skills\/overview',\s*to: '\/skills'/);
  assert.match(docusaurusConfig, /from: '\/extensions\/overview',\s*to: '\/extensions'/);
  assert.doesNotMatch(docusaurusConfig, /skills\/skills-extension/);
});

test('production docs config throws on broken links and markdown drift', () => {
  const docusaurusConfig = readFileSync(resolve(MONO_ROOT, 'apps/agentos-live-docs/docusaurus.config.ts'), 'utf8');

  assert.match(
    docusaurusConfig,
    /onBrokenLinks:\s*guidesOnly \? 'ignore' : strictDocs \? 'throw' : 'warn'/,
  );
  assert.match(
    docusaurusConfig,
    /onBrokenMarkdownLinks:\s*guidesOnly \? 'ignore' : strictDocs \? 'throw' : 'warn'/,
  );
});

test('legacy /docs redirects exclude generated api and paracosm routes', () => {
  const docusaurusConfig = readFileSync(resolve(MONO_ROOT, 'apps/agentos-live-docs/docusaurus.config.ts'), 'utf8');

  assert.match(docusaurusConfig, /existingPath\.startsWith\('\/api'\)/);
  assert.match(docusaurusConfig, /existingPath\.startsWith\('\/paracosm'\)/);
  assert.match(docusaurusConfig, /existingPath\.startsWith\('\/blog'\)/);
});

test('guides-only sidebar omits the API reference category', () => {
  const sidebarsPath = resolve(MONO_ROOT, 'apps/agentos-live-docs/sidebars.js');
  const previousGuidesOnly = process.env.AGENTOS_DOCS_GUIDES_ONLY;

  process.env.AGENTOS_DOCS_GUIDES_ONLY = '1';
  delete require.cache[require.resolve(sidebarsPath)];

  try {
    const sidebars = require(sidebarsPath);
    const guideSidebar = sidebars.guideSidebar;
    const hasApiReference = guideSidebar.some(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'label' in item &&
        item.label === 'API Reference',
    );

    assert.equal(hasApiReference, false);
  } finally {
    if (previousGuidesOnly === undefined) {
      delete process.env.AGENTOS_DOCS_GUIDES_ONLY;
    } else {
      process.env.AGENTOS_DOCS_GUIDES_ONLY = previousGuidesOnly;
    }
    delete require.cache[require.resolve(sidebarsPath)];
  }
});
