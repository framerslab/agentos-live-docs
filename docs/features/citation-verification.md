---
title: "Citation Verification"
sidebar_position: 4.5
displayed_sidebar: guideSidebar
description: "Per-claim citation verification for AI agents: split an answer into claims, embed them with the retrieved sources, grade each claim supported, weak or unverifiable by cosine similarity, and mark contradictions with an optional NLI check."
keywords: [citation verification, llm hallucination, claim verification, atomic claims, cosine similarity, nli, grounded llm, ai source verification]
---

LLMs hallucinate citations: they reference papers that do not exist, quote sources unrelated to the claim, or state facts the retrieval never returned. Longer answers compound the failure rate.

`CitationVerifier` grades an answer claim by claim. It splits the text into claims, embeds the claims and the sources in one call, scores each claim against each source by cosine similarity, and gives each claim one of four verdicts: `supported`, `weak`, `unverifiable` or `contradicted`. `contradicted` comes only from an optional NLI function, which is asked about the claims graded `supported`. An agent configured with `verifyCitations` runs the verifier on each `generate()` result.

The implementation lives in [`src/cognition/rag/citation/`](https://github.com/framerslab/agentos/tree/master/src/cognition/rag/citation): [`CitationVerifier`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/CitationVerifier.ts), the [`VerifiedResponse`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/types.ts) and [`VerificationSource`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/types.ts) types, and the [`formatVerifiedResponse`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/format.ts) helper. `@framers/agentos` exports all of them.

![NLI-judged citation verification: a generated answer has its claims extracted; each claim is matched against retrieved chunks and judged by an NLI model; the labels ENTAILED, NEUTRAL and CONTRADICTED are stamped on the answer with citation markers](/img/diagrams/citation-verification-flow.svg)

The diagram shows NLI judging, the method of the [Grounding Guard](/extensions/built-in/grounding-guard). `CitationVerifier` grades by cosine similarity and asks an NLI function only about the claims it graded `supported`.

## The one-flag path

Give the agent `verifyCitations`, and each `generate()` result carries the verdicts on `result.grounding`:

```typescript
import { agent, embedText, type VerificationSource } from '@framers/agentos';

// Your retriever: returns { content, title?, url? } objects for a query.
declare function searchDocs(query: string): Promise<VerificationSource[]>;

const embedFn = async (texts: string[]) =>
  (await embedText({ provider: 'openai', model: 'text-embedding-3-small', input: texts })).embeddings;

const docsAgent = agent({
  provider: 'openai',
  model: 'gpt-4o',
  verifyCitations: {
    embedFn,
    retrieve: (query) => searchDocs(query),
  },
});

const result = await docsAgent.generate('How do I configure a guardrail?');

console.log(result.text);
console.log(result.grounding?.overallGrounded); // false when a claim is contradicted
for (const claim of result.grounding?.claims ?? []) {
  if (claim.verdict !== 'supported') console.warn(claim);
}
```

After the model answers, the agent calls `retrieve` with the user's input and runs [`CitationVerifier`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/CitationVerifier.ts) over the answer and those sources ([`citationVerification.ts`](https://github.com/framerslab/agentos/blob/master/src/api/runtime/citationVerification.ts)). The sources serve the check and do not reach the model. With `retrievalAugmentor` in place of `embedFn` and `retrieve`, the agent retrieves through the augmentor's `retrieveContext()` (with `retrievalOptions`) and embeds through its `embedTexts()`. `supportThreshold`, `unverifiableThreshold`, `nliFn` and `extractClaims` pass through to the verifier.

`result.grounding` is `undefined` when retrieval returns no sources, when neither wiring is complete, or when retrieval or verification throws; outside production a warning is logged. The check never fails the call. Only `generate()` runs it: `stream()` and `session().send()` do not.

[`QueryRouter`](https://github.com/framerslab/agentos/blob/master/src/orchestration/pipeline/query/QueryRouter.ts) takes `verifyCitations: true` and verifies with its own retrieved chunks and embeddings (see [QueryRouter](#queryrouter)).

Use `CitationVerifier` directly when you hold both the text and the sources and want the scoring without an agent.

## Architecture

```
answer text (or a claim list) + sources
  → claims: built-in sentence splitter, or your extractClaims   (CitationVerifier)
  → one embedFn call: claims[] + sources[]                       (your embedFn)
  → cosine similarity of every claim with every source           (CitationVerifier)
  → verdict from the best source: supported / weak / unverifiable
  → optional: nliFn on supported claims → contradicted           (your nliFn)
  → VerifiedResponse with per-claim verdicts                     (citation/types.ts)
```

Where each part lives:

- [`CitationVerifier`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/CitationVerifier.ts) splits, scores and aggregates.
- [`@framers/agentos-ext-grounding-guard`](https://www.npmjs.com/package/@framers/agentos-ext-grounding-guard) exports a `ClaimExtractor` and `createNliFunction()` that fit `extractClaims` and `nliFn` (see [Core API](#core-api)).
- The deprecated [`verify_citations` tool](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/research/citation-verifier/src/VerifyCitationsTool.ts) and the [`fact_check` tool](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/research/web-search/src/tools/factCheck.ts) live in the extensions registry (see [On demand](#on-demand-via-tool)).

## Core API

### CitationVerifier

Source: [`src/cognition/rag/citation/CitationVerifier.ts`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/CitationVerifier.ts).

```typescript
import { CitationVerifier, embedText } from '@framers/agentos';
import { ClaimExtractor, createNliFunction } from '@framers/agentos-ext-grounding-guard';

const extractor = new ClaimExtractor(); // pass an LLM function to split complex sentences

const verifier = new CitationVerifier({
  // Required: batch embedding function
  embedFn: async (texts: string[]) =>
    (await embedText({ provider: 'openai', model: 'text-embedding-3-small', input: texts })).embeddings,

  // Optional: similarity thresholds (defaults shown)
  supportThreshold: 0.6,      // >= this = "supported"
  unverifiableThreshold: 0.3, // < this = "unverifiable"

  // Optional: contradiction check on supported claims (loads @huggingface/transformers)
  nliFn: createNliFunction(),

  // Optional: claim extractor; without it the built-in sentence splitter runs
  extractClaims: async (text) => (await extractor.extract(text)).map((c) => c.claim),
});
```

### Verify Claims

`verify()` accepts the input in two shapes.

**Pattern A: pass raw LLM text and let the verifier split it:**

```typescript
// The verifier splits the text with `extractClaims` when configured,
// otherwise with the built-in sentence splitter.
const result = await verifier.verify(
  "Tokyo is the capital of Japan. " +
  "Tokyo proper has roughly 14 million residents. " +
  "Tokyo hosted the 2020 Summer Olympics in 1457.",
  [
    { content: "Tokyo is the capital and seat of government of Japan.", url: "https://example.com/japan" },
    { content: "The population of Tokyo proper is approximately 14 million.", url: "https://example.com/tokyo" },
  ]
);
```

**Pattern B: pass a claim array, scored as given:**

```typescript
// Each item is scored as-is, with no further splitting.
// result.claims keeps the order of the array.
const claims = [
  "Tokyo is the capital of Japan.",
  "Tokyo proper has roughly 14 million residents.",
  "Tokyo hosted the 2020 Summer Olympics in 1457.",
];

const result = await verifier.verify(claims, [
  { content: "Tokyo is the capital and seat of government of Japan.", url: "https://example.com/japan" },
  { content: "The population of Tokyo proper is approximately 14 million.", url: "https://example.com/tokyo" },
]);
```

**Or inspect the extracted claims before verifying:**

```typescript
// extractClaims() runs the same split Pattern A uses,
// so you can filter or edit the claim list before scoring.
const claims = await verifier.extractClaims(llmGeneratedText);
const filtered = claims.filter((c) => c.length > 20);
const result = await verifier.verify(filtered, sources);
```

### VerifiedResponse

Source: [`src/cognition/rag/citation/types.ts`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/types.ts).

```typescript
{
  claims: [
    {
      text: "Tokyo is the capital of Japan.",
      verdict: "supported",       // best match: source 0
      confidence: 0.87,           // cosine similarity with the best source
      sourceIndex: 0,
      sourceSnippet: "Tokyo is the capital and seat of government of Japan.", // first 200 characters
      sourceRef: "https://example.com/japan",
    },
    {
      text: "Tokyo proper has roughly 14 million residents.",
      verdict: "supported",       // best match: source 1
      confidence: 0.83,
      sourceIndex: 1,
      sourceSnippet: "The population of Tokyo proper is approximately 14 million.",
      sourceRef: "https://example.com/tokyo",
    },
    {
      text: "Tokyo hosted the 2020 Summer Olympics in 1457.",
      verdict: "unverifiable",    // best similarity below 0.3
      confidence: 0.12,
      sourceIndex: 0,             // the best source is reported whenever a similarity is above 0
      sourceSnippet: "Tokyo is the capital and seat of government of Japan.",
      sourceRef: "https://example.com/japan",
    },
  ],
  overallGrounded: true,          // no claim is contradicted
  supportedRatio: 0.67,           // 2 of 3 claims supported (shown rounded)
  totalClaims: 3,
  supportedCount: 2,
  weakCount: 0,
  unverifiableCount: 1,
  contradictedCount: 0,
}
```

For a one-line human summary (`"2/3 claims verified (67%)"`, or `"No verifiable claims found."` when there are no claims), use the
[`formatVerifiedResponse`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/format.ts) helper:

```typescript
import { formatVerifiedResponse } from '@framers/agentos';
console.log(formatVerifiedResponse(result));
```

## Verdicts

| Verdict | Cosine similarity (defaults) | Meaning |
|---------|-------------------|---------|
| `supported` | >= 0.6 | The claim's best source matches it |
| `weak` | 0.3 to below 0.6 | Partial match, lower confidence |
| `unverifiable` | < 0.3 | No source matches the claim |
| `contradicted` | `supported` first | `nliFn` labels the best source a `contradiction` with a score above 0.7 |

`supportThreshold` and `unverifiableThreshold` move the first three bands. An `nliFn` that throws leaves the cosine verdict.

## When Verification Runs

### QueryRouter

With `verifyCitations: true` (the default is `false`), [`QueryRouter`](https://github.com/framerslab/agentos/blob/master/src/orchestration/pipeline/query/QueryRouter.ts)'s `route()` verifies its final answer when both of these hold:

- the route retrieved chunks with content to verify against
- the router has an embedding manager for the similarity scoring

It uses the default thresholds, the built-in sentence splitter and no NLI, and attaches the result to `QueryResult.grounding`. When a condition fails or verification throws, `grounding` is `undefined`.

Outside QueryRouter, you can run the verifier in host-managed flows:

- call [`CitationVerifier`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/CitationVerifier.ts) directly after generation
- give an agent `verifyCitations` (see [The one-flag path](#the-one-flag-path))
- run it over a research report your own code produced (see below)

### Deep Research Synthesis

When a QueryRouter route runs [deep research](/features/rag-memory#query-classification) (the host's `deepResearch` callback), the research sources join the retrieved chunks and the synthesis goes to the generator. With `verifyCitations: true` the router then scores the answer it wrote from that report against the chunks, research sources included.

To check a report your own code produced, call `verifier.verify(report, sources)` with the report's sources mapped to the [`VerificationSource`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/types.ts) shape (`{ content, title?, url? }`).

### On demand (via tool)

The deprecated `@framers/agentos-ext-citation-verifier` package wraps the same scoring in a [`verify_citations`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/research/citation-verifier/src/VerifyCitationsTool.ts) tool; new code uses `CitationVerifier` from `@framers/agentos`. The tool takes `{ text, sources?, webFallback? }`:

```typescript
verify_citations({
  text: "The speed of light is 300,000 km/s in a vacuum.",
  sources: [
    { content: "Light travels at 299,792 km/s in vacuum.", title: "Physics Reference" }
  ],
})
```

It scores only when the pack is created with an embedding function (`createExtensionPack({ config: { embedFn } })`); without one it returns no claims. It splits sentences itself, with no `extractClaims` and no NLI, and reports each claim's best source as `source: { title, snippet, url }`. `webFallback: true` changes no verdict: the tool builds the [`fact_check`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/research/web-search/src/tools/factCheck.ts) tool without a search service and reads its verdict from the wrong field.

### Via Skill

The [`fact-grounding` skill](https://github.com/framerslab/agentos-skills/blob/master/registry/curated/fact-grounding/SKILL.md) requires the `verify_citations` tool and instructs the agent to:
1. Verify key factual claims before presenting them to the user
2. Mark unverified claims with "[unverified]"
3. Cite sources inline: "According to [Source Title]..."
4. Flag contradictions with both sides presented

## Claim Extraction

Without `extractClaims`, `verify()` and `extractClaims()` use the built-in splitter:

1. Remove fenced code blocks
2. Split after `.`, `!` or `?` followed by whitespace
3. Drop questions (ending in `?`), hedges (starting with `I think`, `Maybe` or `Perhaps`) and sign-offs (starting with `I hope`, `Let me know` or `Feel free`)
4. Keep sentences longer than 15 characters

The `ClaimExtractor` of [`@framers/agentos-ext-grounding-guard`](https://www.npmjs.com/package/@framers/agentos-ext-grounding-guard) also splits on line breaks, drops sentences it does not judge factual, and, when constructed with an LLM function, decomposes complex sentences into atomic claims. Its `extract()` returns objects; pass their `claim` strings to `extractClaims` (see [Core API](#core-api)).

## Performance

- **Embedding**: one `embedFn` call per `verify()`, with the claims and the sources in one batch
- **Scoring**: one cosine similarity per claim and source
- **Model calls**: `CitationVerifier` makes none of its own; `extractClaims` runs once per text input and `nliFn` once per `supported` claim, one claim after another

## Source Files

| Symbol | Repo | Path |
|---|---|---|
| [`CitationVerifier`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/CitationVerifier.ts) | `framerslab/agentos` | `src/cognition/rag/citation/CitationVerifier.ts` |
| [`VerifiedResponse`, `VerificationSource`, `ClaimVerdict`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/types.ts) (types) | `framerslab/agentos` | `src/cognition/rag/citation/types.ts` |
| [`formatVerifiedResponse`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/citation/format.ts) | `framerslab/agentos` | `src/cognition/rag/citation/format.ts` |
| [Citation tree (re-exports)](https://github.com/framerslab/agentos/tree/master/src/cognition/rag/citation) | `framerslab/agentos` | `src/cognition/rag/citation/` |
| [`runCitationVerification`](https://github.com/framerslab/agentos/blob/master/src/api/runtime/citationVerification.ts) (agent `verifyCitations`) | `framerslab/agentos` | `src/api/runtime/citationVerification.ts` |
| [`QueryRouter`](https://github.com/framerslab/agentos/blob/master/src/orchestration/pipeline/query/QueryRouter.ts) | `framerslab/agentos` | `src/orchestration/pipeline/query/QueryRouter.ts` |
| `ClaimExtractor`, `createNliFunction` | [`@framers/agentos-ext-grounding-guard`](https://www.npmjs.com/package/@framers/agentos-ext-grounding-guard) (npm) | `src/ClaimExtractor.ts`, `src/nli.ts` |
| [`verify_citations` tool (`VerifyCitationsTool`)](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/research/citation-verifier/src/VerifyCitationsTool.ts) | `framerslab/agentos-extensions` | `registry/curated/research/citation-verifier/src/VerifyCitationsTool.ts` |
| [`fact_check` tool](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/research/web-search/src/tools/factCheck.ts) | `framerslab/agentos-extensions` | `registry/curated/research/web-search/src/tools/factCheck.ts` |
| [`fact-grounding` skill (`SKILL.md`)](https://github.com/framerslab/agentos-skills/blob/master/registry/curated/fact-grounding/SKILL.md) | `framerslab/agentos-skills` | `registry/curated/fact-grounding/SKILL.md` |

## Related Features

- [Grounding Guard](/extensions/built-in/grounding-guard): NLI verification of claims as a guardrail
- [Reranker Chain](/features/rag-memory#reranker-chain): multi-stage result ranking before citation
- [Deep Research](/features/rag-memory#query-classification): the research step whose sources and synthesis feed QueryRouter's answer
- [Content Policy Rewriter](/extensions/built-in/content-policy-rewriter): content filtering guardrail
