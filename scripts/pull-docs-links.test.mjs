import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { rewriteMarkdownLinks } from './pull-docs-links.mjs';

const require = createRequire(import.meta.url);
const { buildFilenameRewriteMap } = require('../../../packages/agentos/docs/publication-manifest.cjs');

const options = {
  linkRewrites: buildFilenameRewriteMap(),
  exactLinkRewrites: {
    './security-pipeline.md': '/features/human-in-the-loop',
  },
  curatedLinkRewrites: {},
};

test('rewriteMarkdownLinks rewrites moved docs case-insensitively', () => {
  // ./hyde-retrieval.md differs from the source file HYDE_RETRIEVAL.md in case and separator.
  const input = 'See [Getting Started](./GETTING_STARTED.md), [HyDE Retrieval](./hyde-retrieval.md), and [Streaming](./STREAMING_SEMANTICS.md).';
  const output = rewriteMarkdownLinks(input, options);

  assert.equal(
    output,
    'See [Getting Started](/getting-started), [HyDE Retrieval](/features/hyde-retrieval), and [Streaming](/architecture/streaming-semantics).',
  );
});

test('rewriteMarkdownLinks rewrites uncensored content feature docs into the published route', () => {
  const input = 'See [Uncensored Content](./UNCENSORED_CONTENT.md).';
  const output = rewriteMarkdownLinks(input, options);

  assert.equal(output, 'See [Uncensored Content](/features/uncensored-content).');
});

test('rewriteMarkdownLinks rewrites media guide crosslinks for published feature docs', () => {
  const input =
    'See [Character Consistency](./CHARACTER_CONSISTENCY.md) and [Style Transfer](./STYLE_TRANSFER.md).';
  const output = rewriteMarkdownLinks(input, options);

  assert.equal(
    output,
    'See [Character Consistency](/features/character-consistency) and [Style Transfer](/features/style-transfer).',
  );
});

test('rewriteMarkdownLinks rewrites repo source links to public GitHub blob URLs', () => {
  const input = 'Read [AgentOS.ts](packages/agentos/src/api/AgentOS.ts#L14-L34) and [types](../src/api/types.ts).';
  const output = rewriteMarkdownLinks(input, options);

  assert.equal(
    output,
    'Read [AgentOS.ts](https://github.com/framerslab/agentos/blob/master/src/api/AgentOS.ts#L14-L34) and [types](https://github.com/framerslab/agentos/blob/master/src/api/types.ts).',
  );
});

test('rewriteMarkdownLinks strips legacy /docs prefixes and rewrites examples', () => {
  const input =
    'See [Guardrails](/docs/features/guardrails), [API](/docs/api), and [Example](../../examples/high-level-api.mjs).';
  const output = rewriteMarkdownLinks(input, options);

  assert.equal(
    output,
    'See [Guardrails](/features/guardrails), [API](/api), and [Example](https://github.com/framerslab/agentos/blob/master/examples/high-level-api.mjs).',
  );
});

test('rewriteMarkdownLinks falls back unknown curated registry links to GitHub', () => {
  const input =
    'Browse [Deep Research](./registry/curated/research/deep-research) and [Web Search](./registry/curated/research/web-search).';
  const output = rewriteMarkdownLinks(input, {
    ...options,
    curatedLinkRewrites: {
      './registry/curated/research/web-search': '/extensions/built-in/web-search',
    },
  });

  assert.equal(
    output,
    'Browse [Deep Research](https://github.com/framerslab/agentos-extensions/tree/master/registry/curated/research/deep-research) and [Web Search](/extensions/built-in/web-search).',
  );
});

test('rewriteMarkdownLinks preserves explicit exact rewrites', () => {
  const input = 'See [Security Pipeline](./security-pipeline.md).';
  const output = rewriteMarkdownLinks(input, options);

  assert.equal(output, 'See [Security Pipeline](/features/human-in-the-loop).');
});

test('rewriteMarkdownLinks turns relative source links of any depth into repository links', () => {
  const input = 'See [`src/api/agency.ts`](../../src/api/agency.ts) and [`src/api/hitl.ts`](../src/api/hitl.ts).';
  const output = rewriteMarkdownLinks(input, options);

  assert.equal(
    output,
    'See [`src/api/agency.ts`](https://github.com/framerslab/agentos/blob/master/src/api/agency.ts) and [`src/api/hitl.ts`](https://github.com/framerslab/agentos/blob/master/src/api/hitl.ts).',
  );
});
