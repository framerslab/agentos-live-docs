import { basename } from 'node:path';

const AGENTOS_BLOB_BASE = 'https://github.com/framerslab/agentos/blob/master/';
const MONOREPO_BLOB_BASE = 'https://github.com/manicinc/voice-chat-assistant/blob/master/';
const EXTENSIONS_CURATED_TREE_BASE =
  'https://github.com/framerslab/agentos-extensions/tree/master/registry/curated/';

function normalizeDocKey(value) {
  return basename(String(value || ''))
    .replace(/\\/g, '/')
    .toLowerCase()
    .replace(/-/g, '_');
}

function toAgentosSourceBlob(hrefPath) {
  const path = String(hrefPath || '').trim();
  if (!path) return null;

  const examplesMatch = path.match(/(?:^|\/)examples\/(.+)$/);
  if (examplesMatch?.[1]) {
    return `${AGENTOS_BLOB_BASE}examples/${examplesMatch[1]}`;
  }

  if (path.startsWith('packages/agentos/src/')) {
    return `${AGENTOS_BLOB_BASE}${path.slice('packages/agentos/'.length)}`;
  }
  const relativeSrc = path.match(/^(?:\.\.\/)+src\/(.+)$/);
  if (relativeSrc?.[1]) {
    return `${AGENTOS_BLOB_BASE}src/${relativeSrc[1]}`;
  }
  if (path.startsWith('./src/')) {
    return `${AGENTOS_BLOB_BASE}${path.slice(2)}`;
  }
  if (path.startsWith('src/')) {
    return `${AGENTOS_BLOB_BASE}${path}`;
  }

  return null;
}

function toMonorepoSourceBlob(hrefPath) {
  const path = String(hrefPath || '').trim();
  if (!path) return null;

  if (path.startsWith('packages/') || path.startsWith('apps/') || path.startsWith('examples/')) {
    return `${MONOREPO_BLOB_BASE}${path}`;
  }

  return null;
}

function stripLegacyDocsPrefix(hrefPath) {
  const path = String(hrefPath || '').trim();
  if (path === '/docs') return '/';
  if (path.startsWith('/docs/')) return `/${path.slice('/docs/'.length)}`;
  return null;
}

function toCuratedRegistryUrl(hrefPath, curatedLinkRewrites) {
  const rawPath = String(hrefPath || '').trim();
  if (!rawPath) return null;

  const normalizedPath = rawPath.replace(/^\.\//, '');
  const normalizedNoTrailing = normalizedPath.endsWith('/')
    ? normalizedPath.slice(0, -1)
    : normalizedPath;

  const curated =
    curatedLinkRewrites[rawPath] ||
    curatedLinkRewrites[rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath] ||
    curatedLinkRewrites[normalizedPath] ||
    curatedLinkRewrites[normalizedNoTrailing];

  if (curated) return curated;

  if (normalizedNoTrailing.startsWith('registry/curated/')) {
    return `${EXTENSIONS_CURATED_TREE_BASE}${normalizedNoTrailing.slice('registry/curated/'.length)}`;
  }

  return null;
}

export function rewriteMarkdownLinks(content, {
  linkRewrites = {},
  exactLinkRewrites = {},
  curatedLinkRewrites = {},
} = {}) {
  const normalizedDocRewrites = Object.fromEntries(
    Object.entries(linkRewrites).map(([from, to]) => [normalizeDocKey(from), to]),
  );

  return content.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (match, text, hrefRaw) => {
    const href = String(hrefRaw || '').trim();
    if (!href) return match;

    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('#') ||
      href.startsWith('mailto:')
    ) {
      return match;
    }

    const [hrefPathRaw, anchorRaw] = href.split('#');
    const hrefPath = String(hrefPathRaw || '').trim();
    const anchor = anchorRaw ? `#${anchorRaw}` : '';
    const hrefNoTrailing = hrefPath.endsWith('/') ? hrefPath.slice(0, -1) : hrefPath;

    const exact = exactLinkRewrites[hrefPath] || exactLinkRewrites[hrefNoTrailing];
    if (exact) return `[${text}](${exact}${anchor})`;

    const legacyDocsPath = stripLegacyDocsPrefix(hrefPath);
    if (legacyDocsPath) return `[${text}](${legacyDocsPath}${anchor})`;

    const curated = toCuratedRegistryUrl(hrefPath, curatedLinkRewrites);
    if (curated) return `[${text}](${curated}${anchor})`;

    const rewrittenSource = toAgentosSourceBlob(hrefPath);
    if (rewrittenSource) return `[${text}](${rewrittenSource}${anchor})`;

    const rewrittenMonorepoSource = toMonorepoSourceBlob(hrefPath);
    if (rewrittenMonorepoSource) return `[${text}](${rewrittenMonorepoSource}${anchor})`;

    const rewrittenDoc = normalizedDocRewrites[normalizeDocKey(hrefPath)];
    if (rewrittenDoc) return `[${text}](${rewrittenDoc}${anchor})`;

    return match;
  });
}
