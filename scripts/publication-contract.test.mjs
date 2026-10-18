import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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

// The deploy and links workflows, read from their files. GitHub evaluates their `${{ }}`
// expressions; evaluate() below runs the parts of that language they use (string literals, the
// github context, ==, !=, !, &&, || and format()) with JavaScript's operators, which give the same
// result for them: && and || return an operand in both, and each comparison here is between
// lowercase strings, where GitHub's case-insensitive == makes no difference. The status functions
// cancelled() and always() answer as they do in a run nobody cancelled; any other is undefined
// here, so a condition that calls one fails its test until the test models it.
const WORKFLOWS = resolve(MONO_ROOT, 'apps/agentos-live-docs/.github/workflows');
const loadWorkflow = (name) => require('js-yaml').load(readFileSync(resolve(WORKFLOWS, name), 'utf8'));

function format(template, ...values) {
  return template.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)]));
}

const cancelled = () => false;
const always = () => true;

function evaluate(source, github) {
  const js = source.replace(/'((?:[^']|'')*)'/g, (_, text) => JSON.stringify(text.replaceAll("''", "'")));
  return new Function('github', 'format', 'cancelled', 'always', `return (${js});`)(github, format, cancelled, always);
}

// A value with expressions in it, such as `links-${{ ... }}`.
function interpolate(text, github) {
  return String(text).replace(/\$\{\{([\s\S]*?)\}\}/g, (_, source) => {
    const value = evaluate(source, github);
    return value === null || value === undefined ? '' : String(value);
  });
}

// An `if:`, with or without `${{ }}`. A job or step without one runs.
function runs(condition, github) {
  if (condition === undefined) return true;
  return Boolean(evaluate(String(condition).trim().replace(/^\$\{\{([\s\S]*)\}\}$/, '$1'), github));
}

const MASTER = 'refs/heads/master';
const OLDER = 'a'.repeat(40);
const NEWER = 'b'.repeat(40);
const RUN = '18000000001';
const OTHER_RUN = '18000000002';

// The github context of a run: its event, ref, commit, attempt and run id.
function context(event_name, ref, { sha = OLDER, attempt = '1', number, runId = RUN } = {}) {
  return { event_name, ref, sha, run_attempt: attempt, run_id: runId, event: number ? { pull_request: { number } } : {} };
}
const pullRequest = (number, options = {}) =>
  context('pull_request', `refs/pull/${number}/merge`, { ...options, number });

// A group with cancel-in-progress must hold one branch's runs, or one pull request's, so a newer run
// cancels an older one there and nowhere else. A re-run builds the commit its first attempt built,
// which can be older than the branch, so it keys a group of its own and never cancels a newer run.
function assertCancelsOnlySupersededRuns(group) {
  const groupOf = (github) => interpolate(group, github);
  const master = groupOf(context('push', MASTER));
  assert.equal(groupOf(context('push', MASTER, { sha: NEWER })), master);
  assert.equal(groupOf(context('schedule', MASTER, { sha: NEWER })), master);
  assert.equal(groupOf(context('workflow_dispatch', MASTER, { sha: NEWER })), master);
  assert.notEqual(groupOf(context('workflow_dispatch', 'refs/heads/try-a-build')), master);
  const pr = groupOf(pullRequest(38));
  assert.notEqual(pr, master);
  assert.equal(groupOf(pullRequest(38, { sha: NEWER })), pr);
  assert.notEqual(groupOf(pullRequest(39)), pr);
  const rerun = groupOf(context('push', MASTER, { attempt: '2' }));
  assert.notEqual(rerun, master);
  assert.notEqual(rerun, groupOf(context('push', MASTER, { attempt: '2', sha: NEWER })));
  assert.notEqual(groupOf(pullRequest(38, { attempt: '2' })), pr);
}

test('the deploy workflow cancels a superseded build, never a deploy part way', () => {
  const workflow = loadWorkflow('deploy.yml');

  // A group for the whole workflow would cancel a run's deploy job too, and a deploy stopped between
  // its deploy and its record leaves the site live and deployed-sources.json naming older sources.
  assert.equal(workflow.concurrency, undefined);
  assert.ok(workflow.jobs.build.concurrency, 'the build job sets a concurrency group');
  assert.equal(workflow.jobs.build.concurrency['cancel-in-progress'], true);
  assertCancelsOnlySupersededRuns(workflow.jobs.build.concurrency.group);
  // Deploys take turns: a newer run's deploy waits for the one running, and replaces an older one
  // that is still waiting.
  const { deploy } = workflow.jobs;
  assert.equal(deploy.concurrency['cancel-in-progress'], false);
  const deployGroup = (github) => interpolate(deploy.concurrency.group, github);
  for (const github of [context('push', MASTER), context('schedule', MASTER), context('workflow_dispatch', MASTER)]) {
    assert.equal(deployGroup(github), 'pages-deploy', `a ${github.event_name} run on master deploys in pages-deploy`);
  }
  // A run that does not deploy keys a group of its own. GitHub's docs do not say whether a job its
  // condition skips takes a place in its group, and in pages-deploy one would replace a deploy
  // waiting there. Group names are compared without case, as GitHub compares them.
  for (const github of [
    pullRequest(38),
    context('push', MASTER, { attempt: '2' }),
    context('workflow_dispatch', 'refs/heads/try-a-build'),
  ]) {
    const group = deployGroup(github);
    assert.notEqual(group.toLowerCase(), 'pages-deploy', `${github.event_name} on ${github.ref}, attempt ${github.run_attempt}`);
    assert.notEqual(group, deployGroup({ ...github, run_id: OTHER_RUN }), 'each run that does not deploy has a group of its own');
  }
  // Records follow their deploys: the deploy job writes its record while it holds the group, so the
  // last record written names the sources of the last deploy. A record job of its own would start
  // waiting for its group a deploy's length after its deploy finished, and GitHub does not promise
  // that a group's jobs run in the order they started waiting.
  assert.equal(workflow.jobs['record-sources'], undefined);
});

test('the deploy workflow deploys a first attempt on master alone', () => {
  const workflow = loadWorkflow('deploy.yml');
  const upload = workflow.jobs.build.steps.find((step) => step.uses?.startsWith('actions/upload-pages-artifact@'));
  const parts = {
    'the artifact upload': upload.if,
    'the deploy job': workflow.jobs.deploy.if,
  };

  for (const [part, condition] of Object.entries(parts)) {
    for (const github of [context('push', MASTER), context('schedule', MASTER), context('workflow_dispatch', MASTER)]) {
      assert.equal(runs(condition, github), true, `${part} runs for a ${github.event_name} run on master`);
    }
    // A full re-run builds the commit its first attempt built, and a re-run of failed jobs deploys
    // the first attempt's build: either can be older than a deploy another run made since, and its
    // deploy, waiting in the deploys' group, would replace a newer deploy waiting there.
    assert.equal(runs(condition, context('push', MASTER, { attempt: '2' })), false, `${part}, re-run on master`);
    assert.equal(runs(condition, context('schedule', MASTER, { attempt: '3' })), false, `${part}, second re-run on master`);
    // The github-pages environment refuses a deploy from another branch, so such a run builds and
    // checks the site and stops there.
    assert.equal(runs(condition, context('workflow_dispatch', 'refs/heads/try-a-build')), false, `${part}, manual run elsewhere`);
    assert.equal(runs(condition, pullRequest(38)), false, `${part}, pull request`);
  }
});

test('the deploy job records the sources it deployed, after the deploy and in the same job', () => {
  const { deploy } = loadWorkflow('deploy.yml').jobs;
  const index = (match) => deploy.steps.findIndex(match);
  const pages = index((step) => step.uses?.startsWith('actions/deploy-pages@'));
  const checkout = index((step) => step.uses?.startsWith('actions/checkout@'));
  const record = index((step) => step.name === 'Update deployed-sources.json');
  assert.ok(pages >= 0 && pages < checkout && checkout < record, 'the deploy job deploys, checks out master, then records');
  // With no condition of their own, the steps after the deploy run only when it succeeded, so a
  // failed deploy records nothing.
  for (const step of deploy.steps.slice(pages + 1)) {
    assert.equal(step.if, undefined, `${step.name ?? step.uses} runs only after a successful deploy`);
  }
  // master's ruleset exempts deploy keys alone from its required checks. The key is a secret of the
  // github-pages environment, whose only allowed branch is master.
  assert.equal(deploy.steps[checkout].with?.ref, 'master');
  assert.equal(deploy.steps[checkout].with?.['ssh-key'], '${{ secrets.DEPLOYED_SOURCES_DEPLOY_KEY }}');
  assert.equal(deploy.environment?.name, 'github-pages');
});

test('a re-run on master fails with the way to deploy, and waits in no group', () => {
  const job = loadWorkflow('deploy.yml').jobs.rerun;
  assert.ok(job, 'deploy.yml has a rerun job');

  // GitHub re-runs a job's dependent jobs with it, so a re-run of build or deploy takes this job
  // along.
  for (const need of ['build', 'deploy']) {
    assert.ok([job.needs].flat().includes(need), `the rerun job needs ${need}`);
  }
  // GitHub skips a job whose needs were skipped unless its condition calls a status function, and
  // in a re-run the deploy job is skipped.
  assert.match(String(job.if), /!\s*cancelled\(\)|\balways\(\)/);
  for (const github of [
    context('push', MASTER, { attempt: '2' }),
    context('schedule', MASTER, { attempt: '2' }),
    context('workflow_dispatch', MASTER, { attempt: '3' }),
  ]) {
    assert.equal(runs(job.if, github), true, `the rerun job runs for a re-run of a ${github.event_name} run on master`);
  }
  for (const github of [
    context('push', MASTER),
    context('schedule', MASTER),
    context('workflow_dispatch', MASTER),
    pullRequest(38, { attempt: '2' }),
    context('workflow_dispatch', 'refs/heads/try-a-build', { attempt: '2' }),
  ]) {
    assert.equal(runs(job.if, github), false, `the rerun job skips ${github.event_name} on ${github.ref}, attempt ${github.run_attempt}`);
  }
  // In the deploys' group it would replace a deploy waiting there, and with an environment it
  // would record a deployment.
  assert.equal(job.concurrency, undefined);
  assert.equal(job.environment, undefined);

  const script = job.steps.map((step) => step.run).filter(Boolean).join('\n');
  const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], { encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'the rerun job fails');
  const error = result.stdout.split('\n').find((line) => line.startsWith('::error::'));
  assert.match(error ?? '', /start this workflow on master/, 'the error says how to deploy master');
});

test('the links workflow cancels a superseded run on its branch or pull request', () => {
  const { concurrency } = loadWorkflow('links.yml');

  assert.ok(concurrency, 'links.yml sets a concurrency group');
  assert.equal(concurrency['cancel-in-progress'], true);
  assertCancelsOnlySupersededRuns(concurrency.group);
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
    'node --test scripts/publication-contract.test.mjs scripts/pull-docs-links.test.mjs plugins/search-manifest.test.js plugins/github-stars.test.js plugins/landing-counts.test.js',
  );
  assert.equal(
    liveDocsPackage.scripts['verify:publication'],
    'AGENTOS_DOCS_STRICT=1 npm run test:publication && AGENTOS_DOCS_STRICT=1 node scripts/pull-docs.mjs --check && AGENTOS_DOCS_STRICT=1 npm run build && npm run test:built',
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
