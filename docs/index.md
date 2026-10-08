---
title: 'AgentOS'
sidebar_position: 0
slug: /documentation
description: "AgentOS — open-source TypeScript AI agent runtime with cognitive memory (85.6% LongMemEval-S, 70.2% LongMemEval-M), HEXACO personality modulation, runtime tool forging, 11 LLM providers. Apache-2.0."
keywords: [agentos, typescript ai agent framework, ai agent runtime, cognitive memory, hexaco personality, longmemeval, runtime tool forging, open source agent sdk]
---

# AgentOS

[![npm version](https://img.shields.io/npm/v/@framers/agentos?style=flat-square&logo=npm&color=cb3837)](https://www.npmjs.com/package/@framers/agentos)
[![CI](https://img.shields.io/github/actions/workflow/status/framerslab/agentos/ci.yml?branch=master&style=flat-square&logo=github&label=CI)](https://github.com/framerslab/agentos/actions/workflows/ci.yml)
[![tests](https://img.shields.io/badge/tests-3%2C866%2B_passed-2ea043?style=flat-square&logo=vitest&logoColor=white)](https://github.com/framerslab/agentos/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/framerslab/agentos/graph/badge.svg)](https://codecov.io/gh/framerslab/agentos)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=flat-square)](https://opensource.org/licenses/Apache-2.0)

AgentOS is an open-source TypeScript runtime for AI agents that remember, adapt, and write their own tools. Apache-2.0.

```bash
npm install @framers/agentos
```

The runtime carries the parts of an agent that should outlive a single chat completion. Persistent [cognitive memory](/features/cognitive-memory) with eight neuroscience-grounded mechanisms (Ebbinghaus decay, retrieval-induced forgetting, reconsolidation, source-confidence decay, schema encoding, temporal gist, metacognitive feeling-of-knowing, involuntary recall) — each grounded in primary cognitive-science literature, each opt-in. Optional [HEXACO personality](/features/hexaco-personality) vectors that modulate encoding strength, working-memory capacity, and prompt formatting per trait. [Six multi-agent orchestration strategies](/features/agency-api) (sequential, parallel, debate, graph, hierarchical, adaptive). [Two-phase streaming guardrails](/features/guardrails-architecture). A [voice pipeline](/features/voice-pipeline) with VAD, barge-in, and streaming STT/TTS. One dispatch interface across 11 LLM providers.

Agents with `emergent: true` can write tools mid-decision. When the runtime encounters a sub-task no existing capability covers, it generates a TypeScript function with a [Zod](https://zod.dev/) schema, routes it through a separate LLM-as-judge that scores code safety, test correctness, and determinism, and on approval executes it in a hardened `node:vm` sandbox. The forged tool joins the session catalog; promotion to a `SKILL.md` makes it persist across processes. Multi-agent teams that hit a capability gap call `spawn_specialist` and the judge reviews the synthesized agent spec before the specialist joins the live roster.

[100+ first-party extensions](https://www.npmjs.com/package/@framers/agentos-extensions) (channel adapters, tool packs, guardrail packs) and [88 curated `SKILL.md` skills](https://www.npmjs.com/package/@framers/agentos-skills) auto-discover at startup through their respective registries — no manual registration. The same surface that auto-loaded skills join is the surface runtime-forged tools graduate into.

The benchmarks below measure this runtime against alternative memory libraries at the same `gpt-4o` answer model.

:::tip Memory benchmarks (full N=500, gpt-4o reader)
**85.6% on LongMemEval-S** at $0.0090 per correct, 0.4 points behind [Emergence.ai](https://www.emergence.ai/blog/sota-on-longmemeval-with-rag)'s **closed-source SaaS** at 86% and +1.4 points above [Mastra](https://mastra.ai) Observational Memory (84.23%) at matched `gpt-4o` reader. AgentOS ships under [Apache-2.0](https://github.com/framerslab/agentos/blob/master/LICENSE), free to install, fork, and self-host.

**70.2% on LongMemEval-M** at $0.0078 per correct on the 1.5M-token / 500-session haystack — the only open-source library on the public record above 65% on M with publicly reproducible methodology. Competitive with the strongest published M results in the LongMemEval paper ([Wu et al., ICLR 2025](https://arxiv.org/abs/2410.10813): round Top-5 65.7%, session Top-5 71.4%, round Top-10 72.0%).

**[Benchmarks reference](/benchmarks)** · **[Reproducible run JSONs](https://github.com/framerslab/agentos-bench/tree/master/results/runs)** · **[SOTA writeup](https://agentos.sh/en/blog/agentos-memory-sota-longmemeval/)**
:::

## How recall works

AgentOS gates memory through three independent LLM-as-judge classifiers that share one classification pass. Trivial queries — greetings, small talk, general knowledge answerable from context — skip retrieval entirely. Queries that need memory get the retrieval architecture best-suited to the category. The right reader model handles each question type.

![AgentOS classifier-driven memory pipeline: query enters QueryClassifier (T0 short-circuits), MemoryRouter picks retrieval architecture, canonical-hybrid retrieval (BM25 + dense + RRF + Cohere rerank + 6-signal cognitive composite), ReaderRouter picks the reader model, ReadRouter picks the strategy, grounded answer returns. Background consolidation loop on the same brain.](/img/diagrams/memory-system-overview.svg)

| Stage | Primitive | Decision per query |
|---|---|---|
| 1 | `QueryClassifier` | T0/none · T1/simple · T2/moderate · T3/complex |
| 2 | `MemoryRouter` | canonical-hybrid · observational-memory-v10 · v11 |
| 3 | `ReaderRouter` | gpt-4o vs gpt-5-mini per category |

The pipeline costs **one classifier call per query** — Stages 2 and 3 reuse Stage 1's classification. That single call buys 12× lower reader cost on most categories, +10 points on single-session-preference, and a clean abstain path for queries that don't need memory at all. Reproducible run JSONs in [agentos-bench](https://github.com/framerslab/agentos-bench).

## Where to start

- [**Cognitive Memory**](/features/cognitive-memory) — why memory should forget. Eight neuroscience-grounded mechanisms, primary-source citations, the consolidation loop. The story is the page.
- [**GMI architecture**](/architecture/gmi) — what an agent actually is between turns. The turn loop, model calls through a completion gateway with fallback hops, and the chunks a turn streams.
- [**System Architecture**](/architecture/system-architecture) — how the 26 modules compose into a runtime.
- [**Deep Research**](/features/rag-memory#query-classification) — the 3-phase pipeline behind sourced answers.
- [**Emergent Capabilities**](/features/emergent-capabilities) — runtime tool forging, judge approval, sandboxed execution.
- [**Examples Cookbook**](/getting-started/examples) — 18 runnable examples covering agents, agencies, voice, orchestration.
- [**TypeDoc API**](/api/) — every class, interface, function in the runtime.

## Paracosm — the swarm-simulation companion

[Paracosm](https://paracosm.agentos.sh) is an agent-swarm simulation engine I built on AgentOS. Define a world as JSON, run it with HEXACO-typed leaders directing a swarm of specialists and ~100 personality-typed cells, and watch their decisions diverge into measurably different outcomes from an identical seed. Reproducible, forkable, replayable. The swarm is first-class on the API: `RunArtifact.finalSwarm`, `paracosm/swarm` helpers, `GET /api/v1/runs/:runId/swarm` for HTTP consumers.

The reference scenario ships as Mars Genesis — a 100-colonist Mars settlement running from 2035 to 2083 across six turns. Two leaders, same seed, different HEXACO profiles, different futures. Try it live.

**[Live demo](https://paracosm.agentos.sh/sim)** · **[GitHub](https://github.com/framerslab/paracosm)** · **[npm](https://www.npmjs.com/package/paracosm)** · **[API reference](/paracosm)**

---

:::info Talk to us
**[Wilds AI Discord](https://wilds.ai/discord)** for questions, feedback, community. **[Contact AgentOS](https://agentos.sh/en/contact)** for partnerships, security disclosures, enterprise inquiries.
:::
