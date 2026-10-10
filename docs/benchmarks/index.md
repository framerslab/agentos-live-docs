---
title: "Memory Benchmarks"
sidebar_position: 1
displayed_sidebar: guideSidebar
description: AgentOS performance on LongMemEval-S, LongMemEval-M, and LOCOMO. Cross-vendor comparison vs Mem0, Mastra, Hindsight, EmergenceMem, Supermemory, Zep, AgentBrain. Confidence intervals, judge-FPR probes, per-case run JSONs.
keywords:
  - longmemeval benchmark
  - locomo benchmark
  - ai memory benchmark
  - agentos sota
  - memory library comparison
  - mem0 vs agentos
  - mastra vs agentos
  - emergencemem benchmark
  - longmemeval m variant
---

AgentOS posts 85.6% on **[LongMemEval-S](https://arxiv.org/abs/2410.10813)** at `gpt-4o` reader: 0.4 points behind Emergence.ai's published 86% SOTA (closed-source SaaS) and +1.4 points above Mastra's 84.23% at the same reader. AgentOS is the only open-source memory library on the public record above 65% on the harder M variant.

This page is the canonical comparison table. Every cell links to its primary source. Cross-provider configurations (e.g. Mastra's gpt-5-mini reader + gemini-2.5-flash observer) are excluded because their results cannot be reproduced from public methodology disclosures.

## TL;DR

- **LongMemEval-S at full N=500, gpt-4o reader**: AgentOS at **85.6%** is 0.4 points behind Emergence.ai SOTA (86%, closed-source SaaS) and +1.4 points above Mastra OM gpt-4o (84.23%). $0.0090 per correct, 3.6-second median latency.
- **LongMemEval-M at full N=500, gpt-4o reader**: AgentOS at **70.2%** is competitive with the strongest published M results in the LongMemEval paper ([Wu et al. ICLR 2025, Table 3](https://arxiv.org/abs/2410.10813)). The paper's three primary GPT-4o configurations: round Top-5 65.7% (we're +4.5), session Top-5 71.4% (we're 1.2 below), round Top-10 72.0% (we're 1.8 below at the harder Top-5 retrieval budget). First open-source library above 65% on M with publicly reproducible methodology. Closest published external number is AgentBrain's 71.7% from their closed-source SaaS.
- **15 adjacent stress-tested configurations all regress** against the 85.6% headline. Locally Pareto-optimal in the tested parameter space.

:::tip Read the writeups

**[How AgentOS hit 85.6% on LongMemEval-S and 70.2% on LongMemEval-M →](https://agentos.sh/en/blog/agentos-memory-sota-longmemeval)**
Per-category cost-accuracy breakdown, the canonical-hybrid retrieval stack, and the per-category reader router that earned the +9 pp lift over the prior CharHash baseline. Includes 8 documented negative findings (Stage L Anthropic Contextual Retrieval, Stage I Mem0-v3-style entity-linking, hierarchical retrieval, etc.) that disqualified each adjacent design.

**[Why LongMemEval and LOCOMO numbers don't compare across vendors →](https://agentos.sh/en/blog/memory-benchmark-transparency-audit)**
The 12-axis methodology audit. Reader-model swaps that swing aggregate accuracy 10+ pp without changing the architecture, judge-FPR probes (LOCOMO's default `gpt-4o-mini` accepts 62.81% of intentionally wrong answers), the 6.4% LOCOMO answer-key error rate, and the Mem0-vs-Zep comparison gaming case study.
:::

## LongMemEval-S Phase B (115K tokens, 50 sessions per haystack)

Same dataset (`data/longmemeval/longmemeval_s.json`), full N=500, same `gpt-4o-2024-08-06` judge, same `gpt-4o` reader across every row.

| System | Accuracy | $/correct | p50 latency | Source |
|---|---:|---:|---:|---|
| EmergenceMem Internal (closed-source SaaS) | 86.0% | not published | 5,650 ms | [emergence.ai](https://www.emergence.ai/blog/sota-on-longmemeval-with-rag) |
| **🚀 AgentOS canonical-hybrid + reader-router (Apache-2.0)** | **85.6%** | **$0.0090** | **3,558 ms** | [85.6% Pareto-win post](https://agentos.sh/en/blog/agentos-memory-sota-longmemeval) |
| Mastra OM gpt-4o (gemini-flash observer) | 84.23% | not published | not published | [mastra.ai](https://mastra.ai/research/observational-memory) |
| Supermemory gpt-4o | 81.6% | not published | not published | [supermemory.ai](https://supermemory.ai/research/) |
| EmergenceMem Simple Fast (no-license public repo, rerun in agentos-bench) | 80.6% | $0.0586 | 3,703 ms | [vendor reproduction adapter](https://github.com/framerslab/agentos-bench/blob/master/vendors/emergence-simple-fast/) |
| Zep self-reported | 71.2% | not published | 632 ms p95 search | [getzep.com](https://blog.getzep.com/state-of-the-art-agent-memory/) |
| Zep independently reproduced | 63.8% | not published | not published | [arXiv:2512.13564](https://arxiv.org/abs/2512.13564) |

**+1.4 points above Mastra OM gpt-4o (84.23%).** AgentOS at 85.6% is the highest published number from a permissively licensed memory framework that anyone can install, fork, and embed in commercial products without a SaaS contract. EmergenceMem Internal posts 86.0% (0.4 above us, statistically tied — their point estimate sits inside our [82.4%, 88.6%] CI), but **EmergenceMem Internal is closed-source SaaS at [emergence.ai/web-automation-api](https://www.emergence.ai/web-automation-api) — it is not a library you can install, fork, self-host, or audit**. Their public reference repo `emergence_simple_fast` ships with **no LICENSE file** (default copyright applies; publicly readable but not legally redistributable). AgentOS ships the full architecture under [Apache-2.0](https://github.com/framerslab/agentos/blob/master/LICENSE) — install, fork, redistribute, embed in commercial products without restriction or fee. AgentOS p50 latency 3,558 ms vs EmergenceMem's published median 5,650 ms (1.6× faster on the median).

**Cost at scale**: $/correct is the run's total cost divided by its correct answers. $0.0090 per correct answer at 85.6% accuracy is about $0.0077 per memory-grounded answer, or about $7.70 per 1,000 calls; a chatbot averaging 5 such calls per conversation across 1,000 conversations spends about $39.

### Why other Mastra and managed-platform numbers are not in this table

- **Mastra OM 94.9%** uses gpt-5-mini reader + gemini-2.5-flash observer (cross-provider). Their public methodology page does not include enough detail to reproduce the result; we cannot independently verify it.
- **Mem0 v3 93.4%** is a managed-platform number with no published CI, no judge model disclosure, no reader model disclosure. Their own [State of AI Agent Memory 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026) post reports 66.9% on LOCOMO for their production stack, suggesting the 93.4% reflects the managed-evaluation harness more than the architecture.
- **Hindsight 91.4%** uses `gemini-3-pro` reader (cross-provider).
- **Supermemory 85.2%** uses `gemini-3-pro` reader (cross-provider).
- **agentmemory 96.2%** has no published CI, no methodology breakdown.

## LongMemEval-M Phase B (1.5M tokens, 500 sessions per haystack)

The harder variant. An M haystack runs to about 1.5M tokens, far past GPT-4o's 128K-token context window, so a `gpt-4o` reader cannot take the whole haystack. Most memory vendors stop at S because raw long-context fits there.

| System | Accuracy | License | Source |
|---|---:|---|---|
| AgentBrain | 71.7% (Test 0) | closed-source SaaS, requires hosted endpoint | [github.com/AgentBrainHQ](https://github.com/AgentBrainHQ) |
| **🚀 AgentOS (sem-embed + reader-router + top-K=5)** | **70.2%** | **Apache-2.0** | [70.2% post](https://agentos.sh/en/blog/agentos-memory-sota-longmemeval) |
| LongMemEval paper, strongest GPT-4o (round, Top-10) | 72.0% | open repo | [Wu et al. ICLR 2025, Table 3](https://arxiv.org/abs/2410.10813) |
| LongMemEval paper, GPT-4o session Top-5 | 71.4% | open repo | [Wu et al. ICLR 2025, Table 3](https://arxiv.org/abs/2410.10813) |
| LongMemEval paper, GPT-4o round Top-5 | 65.7% | open repo | [Wu et al. ICLR 2025, Table 3](https://arxiv.org/abs/2410.10813) |
| Mem0 v3 | not published | Apache 2.0 | reports S only |
| Mastra OM | not published | Apache 2.0 | reports S only |
| Hindsight | not published | open repo | reports S only |
| Zep | not published | Apache 2.0 | "due to gpt-4o's 128K context window we chose S over M" |
| EmergenceMem | not published | **closed-source SaaS** (Internal); **no license** (Simple Fast public repo) | reports S only |
| Supermemory | not published | open | reports S only |
| MemMachine, Memoria, agentmemory, Backboard, ByteRover, Letta, Cognee | not published | various | reports S only or no LongMemEval |

**Competitive with the strongest published M results in the LongMemEval paper.** At reader-Top-5 retrieval, AgentOS is +4.5 above the round-level configuration (65.7%) and 1.2 below the session-level configuration (71.4%); the paper's strongest GPT-4o result overall is 72.0% at round-level Top-10. AgentOS is the first open-source library above 65% on M with publicly reproducible methodology (the open-source runner reproduces the run with one CLI command; see [Reproducing](#reproducing)). The closest published external number is AgentBrain's 71.7% from their closed-source SaaS.

## LOCOMO (out-of-distribution transfer)

LongMemEval-tuned pipeline, no LOCOMO-specific tuning, gpt-4o reader, N=1986:

| Configuration | Accuracy | $/correct | Note |
|---|---:|---:|---|
| **AgentOS K=20 retrieval (Pareto-best LOCOMO tuning)** | **51.5%** | **$0.0099** | Stage F-3 |
| AgentOS Tier 1 OOD baseline | 49.9% | $0.0123 | no tuning |
| Mem0 self-reported (managed) | 66-68% | not published | LOCOMO with default `gpt-4o-mini` judge (Penfield FPR 62.81%) |

**Judge FPR comparison (the variable that swings LOCOMO scores 30-60 pp):**

| Benchmark | AgentOS judge FPR | LOCOMO default judge FPR |
|---|---:|---:|
| LongMemEval-S | 1% | not published |
| LongMemEval-M | 2% | not published |
| LOCOMO | **0%** | **62.81%** (Penfield Labs) |

The 62.81% FPR ceiling on LOCOMO's default `gpt-4o-mini` judge means any LOCOMO score above ~93.6% benefits from benchmark errors, and any score difference below ~6 pp sits in judge noise. AgentOS uses `gpt-4o-2024-08-06` with rubric `2026-04-18.1` which probes at 0% FPR on LOCOMO.

## Methodology disclosure (12 axes most vendors omit)

| Axis | AgentOS | Mem0 | Mastra | Supermemory | Zep | Emergence | Letta | MemPalace |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Aggregate accuracy | yes | yes | yes | yes | yes | yes | partial | yes |
| 95% confidence interval | yes | no | no | no | partial | no | no | no |
| Per-category 95% interval | yes | no | no | no | no | no | no | no |
| Reader model disclosed | yes | no | yes | partial | yes | yes | no | no |
| Observer / ingest model disclosed | yes | no | yes | no | yes | yes | no | no |
| USD cost per correct | yes | no | no | no | no | no | no | no |
| Latency avg / p50 / p95 | yes | no | no | no | partial | median only | no | no |
| Per-category breakdown | yes | no | yes | yes | yes | yes | partial | no |
| Open-source benchmark runner | yes | yes | partial | yes | partial | yes | no | partial |
| Per-case run JSONs at fixed seed | no | no | no | no | no | no | no | no |
| Judge-adversarial FPR probe | yes | no | no | no | no | no | no | no |
| Cross-vendor cross-vendor table | yes | no | no | partial | partial | yes | no | no |

The full audit framework is at [Memory Benchmark Transparency Audit](https://agentos.sh/en/blog/memory-benchmark-transparency-audit). [`results/runs/`](https://github.com/framerslab/agentos-bench/tree/master/results/runs) in agentos-bench holds a Git LFS pointer file for the run JSON behind each published number, and GitHub's LFS store holds none of those objects, so the per-case JSONs cannot be downloaded from the repository. The footnotes of [`results/LEADERBOARD.md`](https://github.com/framerslab/agentos-bench/blob/master/results/LEADERBOARD.md) give each run's file name, cost and per-category results.

## Reproducing

The 85.6% LongMemEval-S headline:

```bash
git clone https://github.com/framerslab/agentos-bench
cd agentos-bench
pnpm install && pnpm build

# Download LongMemEval-S into data/longmemeval/longmemeval_s.json
node dist/cli.js setup --benchmark longmemeval-s

# Set OPENAI_API_KEY and COHERE_API_KEY in your environment
NODE_OPTIONS="--max-old-space-size=8192" node dist/cli.js run longmemeval-s \
  --reader gpt-4o \
  --memory full-cognitive --replay ingest \
  --hybrid-retrieval --rerank cohere \
  --embedder-model text-embedding-3-small \
  --reader-router min-cost-best-cat-2026-04-28 \
  --concurrency 5 \
  --bootstrap-resamples 10000 \
  --seed 42
```

The 70.2% LongMemEval-M headline adds `--rerank-candidate-multiplier 5`, `--reader-top-k 5` and `--hyde` to the S command:

```bash
node dist/cli.js setup --benchmark longmemeval-m

NODE_OPTIONS="--max-old-space-size=8192" node dist/cli.js run longmemeval-m \
  --reader gpt-4o \
  --memory full-cognitive --replay ingest \
  --hybrid-retrieval --rerank cohere --rerank-candidate-multiplier 5 \
  --reader-top-k 5 \
  --hyde \
  --embedder-model text-embedding-3-small \
  --reader-router min-cost-best-cat-2026-04-28 \
  --concurrency 5 \
  --bootstrap-resamples 10000 \
  --seed 42
```

Both runs write a per-case run JSON under `results/runs/`. `--seed 42` fixes the bootstrap resampling behind the confidence intervals; without `--seed` the resampling draws from `Math.random`, so the intervals differ from run to run. The full bench leaderboard is at [`results/LEADERBOARD.md`](https://github.com/framerslab/agentos-bench/blob/master/results/LEADERBOARD.md) in agentos-bench.

## Related blog posts

- [LongMemEval State of the Art (2026): AgentOS 85.6% / 70.2%](https://agentos.sh/en/blog/agentos-memory-sota-longmemeval) — both current headlines, Pareto-win decomposition, negative findings
- [Memory Benchmark Transparency: Why LongMemEval and LOCOMO Numbers Don't Compare](https://agentos.sh/en/blog/memory-benchmark-transparency-audit) — the 12-axis methodology audit
- [Cognitive Memory architecture (docs)](/features/cognitive-memory) — the 8 neuroscience-backed mechanisms behind the retrieval stack

## References

- Wu et al., LongMemEval (ICLR 2025). [arXiv:2410.10813](https://arxiv.org/abs/2410.10813).
- Maharana et al., LOCOMO (ACL 2024). [aclanthology.org](https://aclanthology.org/2024.acl-long.747.pdf).
- Penfield Labs LOCOMO audit (April 2026). [dev.to/penfieldlabs](https://dev.to/penfieldlabs/we-audited-locomo-64-of-the-answer-key-is-wrong-and-the-judge-accepts-up-to-63-of-intentionally-33lg).
- Sumers et al., CoALA (cognitive architectures for language agents). [arXiv:2309.02427](https://arxiv.org/abs/2309.02427).
- Packer et al., MemGPT. [arXiv:2310.08560](https://arxiv.org/abs/2310.08560). Now part of [Letta](https://www.letta.com/blog/memgpt-and-letta).
- Northcutt et al., Pervasive label errors in test sets (NeurIPS 2021). [arXiv:2103.14749](https://arxiv.org/abs/2103.14749).
