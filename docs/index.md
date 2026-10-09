---
title: 'AgentOS'
sidebar_position: 0
slug: /documentation
description: "AgentOS — open-source TypeScript AI agent runtime with cognitive memory (85.6% LongMemEval-S, 70.2% LongMemEval-M), HEXACO personality modulation, runtime tool forging, 13 LLM providers. Apache-2.0."
keywords: [agentos, typescript ai agent framework, ai agent runtime, cognitive memory, hexaco personality, longmemeval, runtime tool forging, open source agent sdk]
---

# AgentOS

[![npm version](https://img.shields.io/npm/v/@framers/agentos?style=flat-square&logo=npm&color=cb3837)](https://www.npmjs.com/package/@framers/agentos)
[![CI](https://img.shields.io/github/actions/workflow/status/framerslab/agentos/ci.yml?branch=master&style=flat-square&logo=github&label=CI)](https://github.com/framerslab/agentos/actions/workflows/ci.yml)
[![tests](https://img.shields.io/badge/tests-9%2C300%2B_passed-2ea043?style=flat-square&logo=vitest&logoColor=white)](https://github.com/framerslab/agentos/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/framerslab/agentos/graph/badge.svg)](https://codecov.io/gh/framerslab/agentos)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=flat-square)](https://opensource.org/licenses/Apache-2.0)

AgentOS is an open-source TypeScript runtime for AI agents that remember, adapt, and write their own tools. Apache-2.0.

```bash
npm install @framers/agentos
```

The runtime carries the parts of an agent that should outlive a single chat completion. Persistent [cognitive memory](/features/cognitive-memory) with Ebbinghaus decay and eight neuroscience-grounded mechanisms (reconsolidation, retrieval-induced forgetting, involuntary recall, metacognitive feeling-of-knowing, temporal gist, schema encoding, source-confidence decay, emotion regulation), each grounded in primary cognitive-science literature. The eight run when the memory manager is given a `cognitiveMechanisms` config, and each can be switched off there. Optional [HEXACO personality](/features/hexaco-personality) traits that write directives into the system prompt and, given to a cognitive memory manager, modulate encoding strength, working-memory capacity and the format of recalled memories. [Six multi-agent orchestration strategies](/features/agency-api) (sequential, parallel, debate, review-loop, hierarchical, graph). [Two-phase streaming guardrails](/features/guardrails-architecture). A [voice pipeline](/features/voice-pipeline) that runs streaming speech-to-text, turn detection, the agent's reply and streaming text-to-speech over one transport, with a barge-in handler for speech over the reply. One dispatch interface across 13 LLM providers.

On the full runtime, `AgentOS.create({ emergent: true })` gives its agents a `forge_tool` tool for writing a tool mid-task; the lightweight `agent()` helper accepts `emergent: true` and does not activate it. A forged tool declares JSON Schema input and output and test cases, and either chains existing tools or, when `emergentConfig.allowSandboxTools` is set, runs agent-written JavaScript. A separate LLM-as-judge scores code safety, test correctness and determinism, and on approval the tool joins the session's catalog. Sandboxed code runs in an in-process `node:vm` context, which Node's documentation says is not a security mechanism, or in a QuickJS WebAssembly instance per call. A tool used 5 or more times with confidence 0.8 or higher that a two-reviewer panel approves is promoted to agent tier, which a runtime with a storage adapter keeps across restarts; `exportToolAsSkillPack()` writes a forged tool out as a `SKILL.md`. In a hierarchical agency with `emergent.enabled`, the manager can call `spawn_specialist` to add an agent to the roster mid-run, and with `emergent.judge: true` a judge reviews each synthesized agent before it joins.

[100+ first-party extensions](https://www.npmjs.com/package/@framers/agentos-extensions) (channel adapters, tool packs, guardrail packs) and [88 curated `SKILL.md` skills](https://www.npmjs.com/package/@framers/agentos-skills) ship as separate packages, each with a registry package that loads them. Extensions load from the manifest a host passes to `AgentOS.create({ extensionManifest })`: `createCuratedManifest()` from `@framers/agentos-extensions-registry` builds one from the curated extensions that are installed, and a runtime without a manifest loads none. Skills reach an agent through `agent({ skills })` or the runtime's capability discovery sources.

The benchmarks below measure this runtime against alternative memory libraries at the same `gpt-4o` answer model.

:::tip Memory benchmarks (full N=500, gpt-4o reader)
**85.6% on LongMemEval-S** at $0.0090 per correct, 0.4 points behind [Emergence.ai](https://www.emergence.ai/blog/sota-on-longmemeval-with-rag)'s **closed-source SaaS** at 86% and +1.4 points above [Mastra](https://mastra.ai) Observational Memory (84.23%) at matched `gpt-4o` reader. AgentOS ships under [Apache-2.0](https://github.com/framerslab/agentos/blob/master/LICENSE), free to install, fork, and self-host.

**70.2% on LongMemEval-M** at $0.0078 per correct on the 1.5M-token / 500-session haystack — the only open-source library on the public record above 65% on M with publicly reproducible methodology. Competitive with the strongest published M results in the LongMemEval paper ([Wu et al., ICLR 2025](https://arxiv.org/abs/2410.10813): round Top-5 65.7%, session Top-5 71.4%, round Top-10 72.0%).

**[Benchmarks reference](/benchmarks)** · **[Reproducible run JSONs](https://github.com/framerslab/agentos-bench/tree/master/results/runs)** · **[SOTA writeup](https://agentos.sh/en/blog/agentos-memory-sota-longmemeval/)**
:::

## How recall works

AgentOS routes memory with small LLM-as-judge classifier calls, up to three per query. When the host runs the `QueryClassifier` gate, trivial queries (greetings, small talk, general knowledge answerable from context) skip retrieval. The `MemoryRouter` classifies the query's category and picks the retrieval architecture for it, `selectReader()` picks the reader model from that category with no further call, and the `ReadRouter` picks the read strategy.

![AgentOS classifier-driven memory pipeline: query enters QueryClassifier (T0 short-circuits), MemoryRouter picks retrieval architecture, canonical-hybrid retrieval (BM25 + dense + RRF + Cohere rerank + 6-signal cognitive composite), ReaderRouter picks the reader model, ReadRouter picks the strategy, grounded answer returns. Background consolidation loop on the same brain.](/img/diagrams/memory-system-overview.svg)

| Stage | Primitive | Decision per query |
|---|---|---|
| 1 | `QueryClassifier` | T0/none · T1/simple · T2/moderate · T3/complex |
| 2 | `MemoryRouter` | canonical-hybrid · observational-memory-v10 · v11 |
| 3 | `selectReader()` (ReaderRouter) | gpt-4o vs gpt-5-mini per category, from Stage 2's category |

`CognitivePipeline.recallAndRead()` makes two classifier calls per query, the MemoryRouter's and the ReadRouter's, and the gate adds one when the host runs it; Stage 3 is a table lookup. With the `min-cost-best-cat-2026-04-28` preset, the reader lookup sends four of the six LongMemEval categories to gpt-5-mini, about 12× cheaper per token than gpt-4o, and lifts single-session-preference by 10 points in the benchmark runs; the gate gives queries that need no memory a path that skips retrieval. Reproducible run JSONs in [agentos-bench](https://github.com/framerslab/agentos-bench).

## Where to start

- [**Cognitive Memory**](/features/cognitive-memory) — why memory should forget. Eight neuroscience-grounded mechanisms, primary-source citations, the consolidation loop. The story is the page.
- [**GMI architecture**](/architecture/gmi) — what an agent actually is between turns. The turn loop, model calls through a completion gateway with fallback hops, and the chunks a turn streams.
- [**System Architecture**](/architecture/system-architecture) — the runtime's layers and the eleven top-level directories of its source.
- [**Deep Research**](/features/rag-memory#query-classification) — the 3-phase pipeline behind sourced answers.
- [**Emergent Capabilities**](/features/emergent-capabilities) — runtime tool forging, judge approval, sandboxed execution.
- [**Examples Cookbook**](/getting-started/examples) — 17 recipes for agents, agencies, query routing and orchestration, and the 18 runnable files in `examples/`.
- [**TypeDoc API**](/api/) — every class, interface, function in the runtime.

## Paracosm — the swarm-simulation companion

[Paracosm](https://paracosm.agentos.sh) is an agent-swarm simulation engine I built on AgentOS. Define a world as JSON, run it with HEXACO-typed leaders directing a swarm of specialists and ~100 personality-typed cells, and watch their decisions diverge into measurably different outcomes from an identical seed. Reproducible, forkable, replayable. The swarm is first-class on the API: `RunArtifact.finalSwarm`, `paracosm/swarm` helpers, `GET /api/v1/runs/:runId/swarm` for HTTP consumers.

The reference scenario ships as Mars Genesis — a 100-colonist Mars settlement running from 2035 to 2083 across six turns. Two leaders, same seed, different HEXACO profiles, different futures. Try it live.

**[Live demo](https://paracosm.agentos.sh/sim)** · **[GitHub](https://github.com/framerslab/paracosm)** · **[npm](https://www.npmjs.com/package/paracosm)** · **[API reference](/paracosm)**

---

:::info Talk to us
**[Wilds AI Discord](https://wilds.ai/discord)** for questions, feedback, community. **[Contact AgentOS](https://agentos.sh/en/contact)** for partnerships, security disclosures, enterprise inquiries.
:::
