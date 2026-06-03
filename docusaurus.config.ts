import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { existsSync } from 'fs';
import { resolve } from 'path';

const disableLocalSearch = process.env.AGENTOS_DOCS_DISABLE_LOCAL_SEARCH === '1';
const disableSearchManifest = process.env.AGENTOS_DOCS_DISABLE_SEARCH_MANIFEST === '1';
const guidesOnly = process.env.AGENTOS_DOCS_GUIDES_ONLY === '1';
const strictDocs = process.env.AGENTOS_DOCS_STRICT !== '0';

// The paracosm typedoc plugin needs the live paracosm source tree at the
// expected sibling path. When this docs site is built standalone (CI on
// the docs repo, not the monorepo), that path is not present, and typedoc
// fails the whole build before Docusaurus can render any blog or guide
// content. Detect the source presence at config time and skip the plugin
// when it is missing — the API reference for paracosm is still cross-
// linked from the monorepo build, and the standalone docs build keeps
// shipping every other update (blog posts, guides, agentos API).
const paracosmSrcPath = resolve(__dirname, '../paracosm/src');
const paracosmSrcAvailable = existsSync(paracosmSrcPath);

// Fetch the GitHub star count for `framerslab/agentos` at build time.
// Doing this at build time (server-side, with a PAT) instead of letting
// the browser hit shields.io's `/github/stars/...` endpoint avoids two
// problems: shields.io's unauthenticated rate-limit fallback that
// renders an "invalid" badge, and the cold-cache flicker on first
// page-loads. The PAT comes from the GH_PAT env var (set as a repo
// secret in CI). If the fetch fails or no PAT is available, the count
// falls back to a hardcoded floor — the badge stays valid even when
// GitHub is unreachable.
const STAR_COUNT_FALLBACK = 268;
async function fetchGithubStars(repo: string): Promise<number> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'agentos-live-docs-build',
  };
  if (process.env.GH_PAT) {
    headers.Authorization = `Bearer ${process.env.GH_PAT}`;
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (!res.ok) {
      console.warn(`[stars] ${repo} fetch returned ${res.status}; using fallback ${STAR_COUNT_FALLBACK}`);
      return STAR_COUNT_FALLBACK;
    }
    const data = (await res.json()) as { stargazers_count?: number };
    if (typeof data.stargazers_count !== 'number') {
      return STAR_COUNT_FALLBACK;
    }
    console.log(`[stars] ${repo}: ${data.stargazers_count}`);
    return data.stargazers_count;
  } catch (err) {
    console.warn(`[stars] ${repo} fetch failed: ${(err as Error).message}; using fallback`);
    return STAR_COUNT_FALLBACK;
  }
}

async function buildConfig(): Promise<Config> {
  const githubStars = await fetchGithubStars('framerslab/agentos');
  return config(githubStars);
}

const config = (githubStars: number): Config => ({
  title: 'AgentOS Docs · Guides, API Reference, Recipes',
  tagline:
    'AgentOS documentation: getting started guides, full API reference, runtime recipes, extension catalog, and benchmark results for the open-source TypeScript AI agent runtime.',
  favicon: 'img/favicon.ico',
  url: 'https://docs.agentos.sh',
  baseUrl: '/',
  organizationName: 'framerslab',
  projectName: 'agentos-live-docs',
  customFields: {
    // Resolved at build time via the GH_PAT-authenticated GitHub API call
    // above. The landing page reads this through useDocusaurusContext()
    // and renders a static shields.io badge with the count baked in,
    // so visitors never trigger an unauthenticated GitHub call.
    githubStars,
  },
  onBrokenLinks: guidesOnly ? 'ignore' : strictDocs ? 'throw' : 'warn',
  clientModules: [
    require.resolve('./src/mermaid-theme.js'),
    require.resolve('./src/mermaid-zoom.js'),
    require.resolve('./src/logo-scroll-to-top.js'),
    require.resolve('./src/scroll-top-on-navigate.js'),
  ],
  trailingSlash: false,

  headTags: [
    // Google Fonts, moved out of the render-blocking @import that used to sit
    // in src/css/custom.css. preconnect warms the DNS + TCP + TLS handshake to
    // both font origins; the direct stylesheet <link> then fetches the font
    // CSS in parallel with the page's own CSS instead of waterfalling behind
    // it. Same families (Inter, JetBrains Mono), weights, and display=swap, so
    // text rendering is unchanged — just paints sooner.
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    },
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/img/favicon-32x32.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/img/favicon-16x16.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/img/favicon.svg',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'description',
        content:
          'AgentOS documentation — guides, tutorials, and TypeDoc API reference for building production AI agents with TypeScript. Graph orchestration, cognitive memory, RAG, guardrails, voice pipelines, and 11 LLM providers.',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'keywords',
        content:
          'AgentOS, AI agent framework, TypeScript AI runtime, multi-agent orchestration, RAG memory, cognitive memory, AI guardrails, prompt injection defense, voice pipeline, LLM providers, agent runtime, AI SDK, open source AI, autonomous agents, agentic AI, agent extensions, agent skills, HEXACO personality, graph orchestration, workflow automation, LangGraph alternative, CrewAI alternative, build AI agents',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'robots',
        content: 'index, follow, max-image-preview:large, max-snippet:-1',
      },
    },
    {
      tagName: 'meta',
      attributes: { name: 'googlebot', content: 'index, follow' },
    },
    {
      tagName: 'meta',
      attributes: { name: 'author', content: 'Frame — https://frame.dev' },
    },
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'AgentOS Documentation',
        url: 'https://docs.agentos.sh',
        description:
          'Official documentation for AgentOS — open-source TypeScript AI agent framework.',
        publisher: {
          '@type': 'Organization',
          name: 'Frame',
          url: 'https://frame.dev',
          sameAs: [
            'https://frame.dev',
            'https://github.com/framerslab',
            'https://www.npmjs.com/package/@framers/agentos',
            'https://wilds.ai/discord',
            'https://wilds.ai',
          ],
          knowsAbout: [
            'AI agent framework',
            'TypeScript AI runtime',
            'multi-agent orchestration',
            'cognitive memory',
            'RAG pipeline',
            'LLM providers',
            'AI guardrails',
          ],
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://docs.agentos.sh/?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      }),
    },
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'AgentOS',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Cross-platform',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        url: 'https://agentos.sh/en',
        downloadUrl: 'https://www.npmjs.com/package/@framers/agentos',
        codeRepository: 'https://github.com/framerslab/agentos',
      }),
    },
    // Microsoft Clarity. Same project ID as agentos.sh main site so
    // session recordings + heatmaps roll up into one Clarity dashboard
    // across the agentos.sh ecosystem. GA already lives below in
    // `presets.gtag` (G-4KEEK15KWZ).
    {
      tagName: 'script',
      attributes: { type: 'text/javascript' },
      innerHTML: `(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "ukky5yykaj");`,
    },
  ],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    format: 'detect', // Allow CommonMark for TypeDoc-generated files (MDX v3 strict)
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: guidesOnly ? 'ignore' : strictDocs ? 'throw' : 'warn',
    },
  },

  themes: [
    '@docusaurus/theme-mermaid',
    ...(!disableLocalSearch
      ? [
          [
            '@easyops-cn/docusaurus-search-local',
            {
              hashed: true,
              language: ['en'],
              indexBlog: false,
              docsRouteBasePath: '/',
              // Generated API/member pages dominate the index and make the
              // build disproportionately expensive for marginal search value.
              ignoreFiles: [/^api\/.+/, /^paracosm\/.+/],
              highlightSearchTermsOnTargetPage: true,
            },
          ],
        ]
      : []),
  ],

  plugins: [
    // Lightweight search manifest for agentos.sh marketing-site DocSearch
    ...(!disableSearchManifest ? ['./plugins/search-manifest.js'] : []),
    // Mark the auto-generated TypeDoc reference trees (/api, /paracosm) as
    // `noindex, follow` at build time. Combined with their removal from the
    // sitemap (see presets.sitemap.ignorePatterns), this moves ~1,970 thin
    // member pages out of Search Console's "Crawled/Discovered — currently
    // not indexed" buckets and into the intentional "Excluded by noindex"
    // state, while the /api and /paracosm landing pages stay indexable.
    './plugins/inject-noindex.js',
    ...(!guidesOnly
      ? [
          [
            'docusaurus-plugin-typedoc',
            {
              entryPoints: ['../../packages/agentos/src/index.ts'],
              tsconfig: '../../packages/agentos/tsconfig.json',
              out: 'docs/api',
              // Avoid pulling in the package README (it contains links that don't
              // resolve inside Docusaurus and duplicates the Guides section).
              readme: 'none',
              categorizeByGroup: false,
              categoryOrder: ['Core', '*'],
              defaultCategory: 'Other',
              sidebar: {
                autoConfiguration: true,
                pretty: true,
              },
              skipErrorChecking: true,
            },
          ],
          ...(paracosmSrcAvailable
            ? [
                [
                  'docusaurus-plugin-typedoc',
                  {
                    id: 'paracosm',
                    entryPoints: [
                      '../../apps/paracosm/src/index.ts',
                      '../../apps/paracosm/src/engine/core/state.ts',
                      '../../apps/paracosm/src/engine/compiler/index.ts',
                      '../../apps/paracosm/src/engine/schema/index.ts',
                      '../../apps/paracosm/src/runtime/swarm/index.ts',
                      '../../apps/paracosm/src/engine/digital-twin/index.ts',
                    ],
                    tsconfig: '../../apps/paracosm/tsconfig.build.json',
                    out: 'docs/paracosm',
                    readme: 'none',
                    sidebar: {
                      autoConfiguration: true,
                      pretty: true,
                    },
                    skipErrorChecking: true,
                  },
                ] as [string, Record<string, unknown>],
              ]
            : []),
        ]
      : []),
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: [
          // Legacy SCREAMING_CASE doc paths from before Docusaurus migration
          { from: '/docs/ARCHITECTURE', to: '/architecture/system-architecture' },
          { from: '/docs/AGENT_COMMUNICATION', to: '/features/agent-communication' },
          { from: '/architecture/emergent-agency-system', to: '/features/emergent-capabilities' },
          { from: '/architecture/multi-gmi-implementation-plan', to: '/architecture/system-architecture' },
          { from: '/features/cognitive-memory-guide', to: '/features/cognitive-memory' },
          // Memory section consolidation (10 pages → 5). Old URLs redirect to
          // the merged canonical pages.
          { from: '/features/cognitive-mechanisms', to: '/features/cognitive-memory#mechanism-implementation-reference' },
          { from: '/features/memory-mechanisms', to: '/features/cognitive-memory#mechanism-implementation-reference' },
          { from: '/features/cognitive-memory-mechanisms', to: '/features/cognitive-memory#mechanism-implementation-reference' },
          { from: '/features/cognitive-memory-guide-mechanisms', to: '/features/cognitive-memory#mechanism-implementation-reference' },
          { from: '/features/memory-architecture', to: '/features/memory-system-overview' },
          { from: '/features/memory-architecture-overview', to: '/features/memory-system-overview' },
          { from: '/features/memory-auto-ingest', to: '/features/memory-operations#auto-ingest-pipeline' },
          { from: '/features/memory-tools', to: '/features/memory-operations#agent-memory-tools' },
          { from: '/features/memory-import-export', to: '/features/memory-operations#import-and-export' },
          { from: '/features/memory-scaling', to: '/features/sql-storage#scaling-path-sqlite--postgres--qdrant' },
          // RAG section consolidation (7 pages → 5). Deep Research and
          // Reranker Chain merged into RAG Memory Configuration.
          { from: '/features/deep-research', to: '/features/rag-memory#query-classification' },
          { from: '/features/reranker-chain', to: '/features/rag-memory#reranker-chain' },
          { from: '/features/query-classification', to: '/features/rag-memory#query-classification' },
          { from: '/docs/CLIENT_SIDE_STORAGE', to: '/features/client-side-storage' },
          { from: '/docs/COST_OPTIMIZATION', to: '/features/cost-optimization' },
          { from: '/docs/ECOSYSTEM', to: '/getting-started/ecosystem' },
          { from: '/docs/EVALUATION_FRAMEWORK', to: '/features/evaluation-framework' },
          { from: '/docs/GUARDRAILS_USAGE', to: '/features/guardrails' },
          { from: '/docs/HUMAN_IN_THE_LOOP', to: '/features/human-in-the-loop' },
          { from: '/docs/PLANNING_ENGINE', to: '/features/planning-engine' },
          { from: '/docs/PLATFORM_SUPPORT', to: '/architecture/platform-support' },
          { from: '/docs/RAG_MEMORY_CONFIGURATION', to: '/features/rag-memory' },
          { from: '/docs/RECURSIVE_SELF_BUILDING_AGENTS', to: '/features/recursive-self-building' },
          { from: '/docs/RELEASING', to: '/getting-started/releasing' },
          { from: '/docs/RFC_EXTENSION_STANDARDS', to: '/extensions/extension-standards' },
          { from: '/docs/SQL_STORAGE_QUICKSTART', to: '/features/sql-storage' },
          { from: '/docs/STRUCTURED_OUTPUT', to: '/features/structured-output' },
          // Renamed getting-started/getting-started → getting-started (index.md)
          { from: '/getting-started/getting-started', to: '/getting-started' },
          // Section overviews moved from /<section>/overview to /<section>
          // (index.md). The old URLs are linked from external blog posts,
          // package READMEs, and the marketing site search index, so keep
          // them as redirects rather than 404s.
          { from: '/extensions/overview', to: '/extensions' },
          { from: '/skills/overview', to: '/skills' },
          // Blog consolidation (Track G, 2026-04-30): docs.agentos.sh/blog/*
          // is retired in favor of a single canonical blog at
          // agentos.sh/en/blog/<slug>. Each docs blog URL redirects to its
          // agentos.sh equivalent where the content has been ported, or to
          // the agentos.sh blog index when the post is engineering-only and
          // hasn't been ported yet (those are queued for a follow-up port).
          // Cross-site duplicate slugs (4 posts), agentos.sh canonical:
          { from: '/blog/2025/11/10/announcing-agentos', to: 'https://agentos.sh/en/blog/announcing-agentos' },
          { from: '/blog/2025/11/15/adaptive-vs-emergent', to: 'https://agentos.sh/en/blog/adaptive-vs-emergent' },
          { from: '/blog/2026/02/20/agentos-vs-langgraph-vs-crewai', to: 'https://agentos.sh/en/blog/agentos-vs-langgraph-vs-crewai' },
          { from: '/blog/2026/03/31/cognitive-memory-beyond-rag', to: '/features/cognitive-memory' },
          // Engineering deep dives (13 posts), redirected to agentos.sh blog
          // index until each is ported. The original slugs stay reserved
          // for the eventual port (we'll point each line directly at
          // /en/blog/<slug> once the post lives there).
          { from: '/blog/2026/03/24/building-agentos-deep-dive', to: 'https://agentos.sh/en/blog' },
          { from: '/blog/2026/04/10/cognitive-memory-architecture-deep-dive', to: 'https://agentos.sh/en/blog' },
          { from: '/blog/2026/04/10/memory-archive-rehydration', to: 'https://agentos.sh/en/blog' },
          { from: '/blog/2026/04/13/mars-genesis-vs-mirofish-multi-agent-simulation', to: 'https://agentos.sh/en/blog/inside-mars-genesis-ai-colony-simulation' },
          { from: '/blog/2026/04/24/memory-benchmark-transparency-audit', to: 'https://agentos.sh/en/blog/memory-benchmark-transparency-audit' },
          { from: '/blog/2026/04/26/agentos-ingest-router-executors', to: 'https://agentos.sh/en/blog' },
          { from: '/blog/2026/04/26/longmemeval-m-30-to-57', to: 'https://agentos.sh/en/blog' },
          { from: '/blog/2026/04/26/longmemeval-m-first-published-number', to: 'https://agentos.sh/en/blog' },
          { from: '/blog/2026/04/26/two-negative-results-stage-l-stage-i', to: 'https://agentos.sh/en/blog' },
          { from: '/blog/2026/04/27/longmemeval-s-83-with-semantic-embedder', to: 'https://agentos.sh/en/blog' },
          { from: '/blog/2026/04/28/reader-router-pareto-win', to: 'https://agentos.sh/en/blog' },
          { from: '/blog/2026/04/29/longmemeval-m-57-with-sem-embed', to: 'https://agentos.sh/en/blog' },
          { from: '/blog/2026/04/29/longmemeval-m-70-with-topk5', to: 'https://agentos.sh/en/blog' },
          // Blog index + listing pages.
          { from: '/blog', to: 'https://agentos.sh/en/blog' },
          { from: '/blog/archive', to: 'https://agentos.sh/en/blog' },
          // 404 cleanup (2026-05-29): deleted/consolidated doc paths that
          // Google Search Console reported as "Not found (404)". Every target
          // was verified live (HTTP 200) before adding. Architecture pages
          // that were merged into the system-architecture overview, plus a
          // handful renamed to clearer slugs.
          { from: '/architecture/backend-api', to: '/architecture/system-architecture' },
          { from: '/architecture/chat-server', to: '/architecture/system-architecture' },
          { from: '/architecture/cli-subprocess', to: '/architecture/system-architecture' },
          { from: '/architecture/runtime-status-matrix', to: '/architecture/system-architecture' },
          { from: '/architecture/http-streaming-api', to: '/architecture/streaming-semantics' },
          { from: '/architecture/extension-loading', to: '/extensions/auto-loading' },
          { from: '/architecture/sandbox-security', to: '/features/safety-primitives' },
          { from: '/architecture/skills-engine', to: '/skills' },
          { from: '/architecture/tool-permissions', to: '/architecture/tool-calling-and-loading' },
          { from: '/architecture/tools', to: '/architecture/tool-calling-and-loading' },
          { from: '/extensions/built-in/tip-ingestion', to: '/extensions' },
          { from: '/features/browser-automation', to: '/extensions/built-in/web-browser' },
          { from: '/features/turn-planner', to: '/features/planning-engine' },
          { from: '/features/skills', to: '/skills' },
          // Internal spec accidentally published pre-migration; redirect the
          // stale indexed URL to the public page covering the same material.
          { from: '/superpowers/specs/2026-04-14-skills-vs-tools-vs-extensions-design', to: '/architecture/skills-vs-tools-vs-extensions' },
        ],
        createRedirects(existingPath: string) {
          // Redirect old /docs/ prefixed guide paths to root (docs are now at /),
          // but do not duplicate generated/reference/non-doc routes.
          if (
            existingPath === '/' ||
            existingPath.startsWith('/docs/') ||
            existingPath.startsWith('/api') ||
            existingPath.startsWith('/paracosm') ||
            existingPath.startsWith('/blog') ||
            existingPath.startsWith('/search') ||
            existingPath.startsWith('/404')
          ) {
            return undefined;
          }
          return ['/docs' + existingPath];
        },
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          exclude: guidesOnly ? ['api/**', 'paracosm/**'] : [],
          editUrl: 'https://github.com/framerslab/agentos-live-docs/tree/master/docs/',
        },
        // Blog plugin disabled: the canonical AgentOS blog is at
        // agentos.sh/en/blog (Track G consolidation, 2026-04-30). Old
        // docs.agentos.sh/blog URLs redirect to the new home via
        // @docusaurus/plugin-client-redirects entries above.
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
        gtag: {
          trackingID: 'G-4KEEK15KWZ',
          anonymizeIP: true,
        },
        sitemap: {
          // Keep sitemap generation decoupled from git tracking state. Generated
          // TypeDoc pages may exist locally before they are committed, and
          // Docusaurus will otherwise warn when it cannot infer a git date.
          lastmod: null,
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: [
            '/tags/**',
            // 404 + search are always-empty / always-stale — they crowd the
            // sitemap without helping Google rank anything.
            '/404',
            '/search',
            '/search/**',
            // Auto-generated TypeDoc reference: ~1,970 thin member pages
            // (interfaces, classes, functions, type-aliases, variables, enums,
            // and the re-exported `z`/zod namespace tree). At ~93% of the
            // route table they made the site read as low-value and Google
            // declined to index them ("Discovered/Crawled — currently not
            // indexed"). Kept out of the sitemap so crawl budget lands on the
            // authored guides, and noindexed at build time by
            // plugins/inject-noindex.js so the already-discovered ones
            // reclassify cleanly. These globs do NOT match the bare `/api` and
            // `/paracosm` landing routes, so those stay in the sitemap as the
            // indexable hubs. (Paracosm also ships its own site at
            // paracosm.agentos.sh, so the copies here are partly cross-site
            // duplicates.)
            '/api/**',
            '/paracosm/**',
            // Docusaurus auto-generated category index pages are thin link
            // lists, not content — they were surfacing as Soft 404 /
            // crawled-not-indexed. Reachable via the sidebar; excluded here.
            '/category/**',
          ],
          filename: 'sitemap.xml',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/og-image-v2.png',
    announcementBar: {
      id: 'longmemeval-sm-2026-04-30',
      content:
        'New benchmarks: 85.6% on LongMemEval-S (+1.4 above <a href="https://mastra.ai" target="_blank" rel="noopener noreferrer">Mastra</a> at gpt-4o) and 70.2% on LongMemEval-M. <a href="https://agentos.sh/en/blog/agentos-memory-sota-longmemeval">Read the post →</a>',
      backgroundColor: 'var(--ifm-color-primary-darkest)',
      textColor: 'var(--ifm-color-white)',
      isCloseable: true,
    },
    navbar: {
      title: '',
      logo: {
        alt: 'AgentOS',
        src: 'img/logo-light.svg',
        srcDark: 'img/logo-dark.svg',
        href: '/',
        height: '52px',
        style: { marginRight: '0.75rem' },
      },
      items: [
        {
          type: 'dropdown',
          label: 'Guides',
          position: 'left',
          to: '/getting-started',
          items: [
            { label: 'Getting Started', to: '/getting-started' },
            { label: 'Memory System', to: '/features/cognitive-memory' },
            { label: 'HEXACO Personality', to: '/features/hexaco-personality' },
            { label: 'Adaptive Prompt Intelligence', to: '/features/adaptive-prompt-intelligence' },
            { label: 'RAG & Vector Storage', to: '/features/rag-memory' },
            { label: 'Vector Scaling', to: '/features/sql-storage' },
            { label: 'Guardrails', to: '/features/guardrails' },
            { label: 'Human-in-the-Loop (HITL)', to: '/features/human-in-the-loop' },
            { label: 'PII Redaction & PHI Scrubbing', to: '/features/pii-redaction' },
            { label: 'Voice Pipeline', to: '/features/voice-pipeline' },
            { label: 'Agency API', to: '/features/agency-api' },
            { label: 'Extensions', to: '/extensions' },
            { label: 'Skills', to: '/skills' },
            { label: 'Paracosm', to: '/features/paracosm' },
            {
              label: '─── Architecture ───',
              to: '/architecture/system-architecture',
              className: 'dropdown-separator',
            },
            { label: 'System Architecture', to: '/architecture/system-architecture' },
            { label: 'Tool Calling', to: '/architecture/tool-calling-and-loading' },
            { label: 'Capability Discovery', to: '/features/capability-discovery' },
            {
              label: '───────────',
              to: '/getting-started',
              className: 'dropdown-separator',
            },
            { label: 'All Guides & Docs', type: 'docSidebar', sidebarId: 'guideSidebar' },
          ],
        },
        ...(!guidesOnly
          ? [
              {
                to: '/api/',
                position: 'left' as const,
                label: 'API Reference',
              },
              {
                href: 'https://paracosm.agentos.sh/docs',
                position: 'left' as const,
                label: 'Paracosm',
              },
            ]
          : []),
        ...(!guidesOnly
          ? [
              {
                href: 'https://agentos.sh/en/blog',
                position: 'left' as const,
                label: 'Blog',
              },
            ]
          : []),
        {
          href: 'https://agentos.sh/en',
          label: 'Website',
          position: 'right' as const,
          className: 'navbar-collapse-md',
        },
        {
          href: 'https://agentos.sh/en/contact',
          label: 'Contact',
          position: 'right' as const,
          className: 'navbar-collapse-md',
        },
        {
          href: 'https://github.com/framerslab/agentos',
          label: 'GitHub',
          position: 'right' as const,
          className: 'header-github-link',
          'aria-label': 'GitHub repository',
        },
      ],
    },
    footer: {
      style: 'light',
      logo: {
        alt: 'Frame.dev',
        src: 'img/frame-logo.svg',
        href: 'https://frame.dev',
        height: '36px',
      },
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting Started', to: '/getting-started' },
            { label: 'Examples', to: '/getting-started/examples' },
            { label: 'Architecture', to: '/architecture/system-architecture' },
            { label: 'Feature Guides', to: '/getting-started/documentation-index' },
            ...(!guidesOnly
              ? [
                  { label: 'API Reference', to: '/api/' },
                  { label: 'Paracosm API', to: '/paracosm/' },
                ]
              : []),
          ],
        },
        {
          title: 'Ecosystem',
          items: [
            { label: 'Frame.dev', href: 'https://frame.dev' },
            { label: 'AgentOS', href: 'https://agentos.sh/en' },
            { label: 'Wilds.ai', href: 'https://wilds.ai' },
            { label: 'Wunderland CLI', href: 'https://wunderland.sh' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/framerslab/agentos' },
            { label: 'Discord', href: 'https://wilds.ai/discord' },
            { label: 'Twitter', href: 'https://x.com/rabbitholewun' },
            { label: 'LinkedIn', href: 'https://www.linkedin.com/company/framerslab' },
            { label: 'npm', href: 'https://www.npmjs.com/package/@framers/agentos' },
          ],
        },
        {
          title: 'Legal',
          items: [
            { label: 'Privacy Policy', href: 'https://agentos.sh/en/legal/privacy' },
            { label: 'Terms of Service', href: 'https://agentos.sh/en/legal/terms' },
            { label: 'Security', href: 'https://agentos.sh/en/legal/security' },
            { label: 'Cookies', href: 'https://agentos.sh/en/legal/cookies' },
          ],
        },
      ],
      copyright: `Copyright \u00A9 ${new Date().getFullYear()} <a href="https://frame.dev" target="_blank" rel="noopener noreferrer" style="color: #00C896;">Framers Lab, Inc.</a>. Open source under Apache 2.0.<br/>Frame is a member of the <a href="https://deepgram.com/startups" target="_blank" rel="noopener noreferrer" style="color: #00C896;">Deepgram Startup Program</a>.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript'],
    },
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: false,
    },
    mermaid: {
      // base + themeVariables lets us drive Mermaid colors from brand tokens.
      // src/mermaid-theme.js (clientModule) post-processes rendered SVGs to
      // swap brand hex values for var(--mer-*) so the diagrams follow the
      // Docusaurus color-mode toggle without forcing a re-render.
      theme: { light: 'base', dark: 'base' },
      options: {
        themeVariables: {
          primaryColor: '#eef2ff',
          primaryTextColor: '#3730a3',
          primaryBorderColor: '#6366f1',
          secondaryColor: '#f1f5f9',
          secondaryTextColor: '#475569',
          secondaryBorderColor: '#94a3b8',
          tertiaryColor: '#f8fafc',
          lineColor: '#94a3b8',
          textColor: '#1e293b',
          mainBkg: '#ffffff',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontSize: '13px',
        },
      },
    },
  } satisfies Preset.ThemeConfig,
});

export default buildConfig;
