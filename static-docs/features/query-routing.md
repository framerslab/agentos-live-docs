---
sidebar_label: Query Router
sidebar_position: 29
---

# Query Router

AgentOS includes a [`QueryRouter`](https://github.com/framerslab/agentos/blob/master/src/orchestration/pipeline/query/QueryRouter.ts) that turns one user question into a three-stage pipeline:

1. classify the query into tier `0` through `3`
2. retrieve the right amount of context
3. generate a grounded answer from that context

## What Is Live Today

- Tier classification uses an LLM prompt with corpus topics, recent conversation history, and optional tool names.
- The router embeds local markdown docs into an in-memory vector store when an embedding provider is available.
- If embeddings are unavailable or vector search fails, the router falls back to keyword search automatically.
- `cacheResults` now backs an in-memory `route()` result cache and is enabled by default.
- `verifyCitations: true` now runs post-generation citation verification when retrieved chunks and embeddings are available.
- Result metadata includes `tiersUsed`, `fallbacksUsed`, and capability `recommendations`.
- Lifecycle events cover classification, retrieval, research, generation, route completion, and capability recommendation activation.

## Execution Paths

- Default path: `route()` classifies the query, then dispatches retrieval through the legacy [`QueryDispatcher`](https://github.com/framerslab/agentos/blob/master/src/orchestration/pipeline/query/QueryDispatcher.ts).
- Opt-in path: if a host calls `setUnifiedRetriever(...)`, `route()` switches to plan-aware retrieval through [`UnifiedRetriever`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/unified/UnifiedRetriever.ts).

This matters because [`UnifiedRetriever`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/unified/UnifiedRetriever.ts) is implemented and usable today, but it is not the default QueryRouter/runtime retrieval path yet.

## Current Limitations

The QueryRouter scaffold is ahead of the wired runtime in a few places:

- `graphExpand()` is currently a built-in corpus-neighborhood heuristic, not yet a true GraphRAG engine.
- `rerank()` is currently a built-in lexical heuristic reranker, not yet a cross-encoder service.
- `deepResearch()` is currently a built-in local-corpus heuristic synthesis pass, not yet a web-backed research runtime.

## Example

```ts
import { QueryRouter } from '@framers/agentos';

const router = new QueryRouter({
  knowledgeCorpus: ['./docs', './packages/agentos/docs'],
  availableTools: ['web_search', 'deep_research'],
});

await router.init();

const result = await router.route('How does memory retrieval work?');

console.log(result.answer);
console.log(result.classification.tier);
console.log(result.recommendations);
console.log(result.sources);
```

## Bundled Platform Knowledge

The QueryRouter ships with **260 pre-built knowledge entries** that cover the AgentOS platform surface:

| Category | Count |
|----------|-------|
| **Tools** | 110 |
| **Skills** | 82 |
| **FAQ** | 38 |
| **API** | 15 |
| **Troubleshooting** | 15 |

Platform knowledge is loaded from `knowledge/platform-corpus.json` inside `@framers/agentos` and merged into the same corpus as your project docs during `init()`.

```ts
const router = new QueryRouter({
  knowledgeCorpus: ['./docs'],
  includePlatformKnowledge: false, // disable if you want project-only routing
});
```

## Recommendations

`route()` returns capability recommendations alongside the grounded answer:

- `skills`
- `tools`
- `extensions`

These are recommendations only. Hosts decide whether to activate or load them.

## Caching And Grounding

- `cacheResults` controls an in-memory cache of completed `route()` results. QueryRouter clears that cache when indexed corpus chunks change and when retrieval-planning dependencies such as [`UnifiedRetriever`](https://github.com/framersai/agentos/blob/master/src/cognition/rag/unified/UnifiedRetriever.ts) or the capability-discovery engine are swapped.
- `verifyCitations` enables post-generation [`CitationVerifier`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/CitationVerifier.ts) runs against the retrieved chunks for a route. When verification runs successfully, the result is attached to `QueryResult.grounding`; if embeddings are unavailable or no chunks were retrieved, verification is skipped gracefully.

## Config Notes

- `knowledgeCorpus` is required.
- `availableTools` only helps the classifier reason about what the runtime can do.
- `githubRepos` optionally enables non-blocking GitHub corpus indexing after `init()`.
- `router.getCorpusStats()` returns a startup snapshot with chunk/topic/source counts, bundled platform-knowledge counts, and runtime mode details.
