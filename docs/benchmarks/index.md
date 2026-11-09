---
title: "Memory Benchmarks"
sidebar_position: 1
displayed_sidebar: guideSidebar
description: Memory library results on LongMemEval-S, LongMemEval-M and LOCOMO, each with its source, from Mem0, Mastra, Hindsight, EmergenceMem, Supermemory, Zep and AgentBrain. AgentOS LOCOMO results and judge-FPR probes; its LongMemEval results are being re-run without a remote reranker.
keywords:
  - longmemeval benchmark
  - locomo benchmark
  - ai memory benchmark
  - memory library comparison
  - mem0 vs agentos
  - mastra vs agentos
  - emergencemem benchmark
  - longmemeval m variant
---

AgentOS's own LongMemEval-S and LongMemEval-M results are being re-run without a remote reranker, so this page does not list them until those runs are published. The tables below give other memory libraries' published figures.

This page is the canonical comparison table. Every cell links to its primary source. Cross-provider configurations (e.g. Mastra's gpt-5-mini reader + gemini-2.5-flash observer) are excluded because their results cannot be reproduced from public methodology disclosures.

## TL;DR

- **AgentOS on LongMemEval-S and LongMemEval-M**: the results are being re-run without a remote reranker.
- **Mem0** posts 94.4% on LongMemEval on [its own evaluation page](https://docs.mem0.ai/core-concepts/memory-evaluation), reader not named.

:::tip Read the writeups

**[Why LongMemEval and LOCOMO numbers don't compare across vendors →](https://agentos.sh/en/blog/memory-benchmark-transparency-audit)**
The 12-axis methodology audit. Reader-model swaps that swing aggregate accuracy 10+ pp without changing the architecture, judge-FPR probes (LOCOMO's default `gpt-4o-mini` accepts 62.81% of intentionally wrong answers), the 6.4% LOCOMO answer-key error rate, and the Mem0-vs-Zep comparison gaming case study.
:::

## LongMemEval-S Phase B (115K tokens, 50 sessions per haystack)

Same dataset (`data/longmemeval/longmemeval_s.json`), full N=500, same `gpt-4o-2024-08-06` judge, and a `gpt-4o` reader on every row. The AgentOS rows are being re-run without a remote reranker.

| System | Accuracy | $/correct | p50 latency | Source |
|---|---:|---:|---:|---|
| EmergenceMem Internal (closed-source SaaS) | 86.0% | not published | 5,650 ms | [emergence.ai](https://www.emergence.ai/blog/sota-on-longmemeval-with-rag) |
| Mastra OM gpt-4o (gemini-flash observer) | 84.23% | not published | not published | [mastra.ai](https://mastra.ai/research/observational-memory) |
| Supermemory gpt-4o | 81.6% | not published | not published | [supermemory.ai](https://supermemory.ai/research/) |
| EmergenceMem Simple Fast (no-license public repo, rerun in agentos-bench) | 80.6% | $0.0581 reader only; $0.0587 with judge | 3,703 ms | [vendor reproduction adapter](https://github.com/framerslab/agentos-bench/blob/master/vendors/emergence-simple-fast/), run `2026-04-28T21-48-40` |
| Zep self-reported | 71.2% | not published | 632 ms p95 search | [getzep.com](https://blog.getzep.com/state-of-the-art-agent-memory/) |

Mastra OM reports 94.87% with a `gpt-5-mini` actor. EmergenceMem Internal posts 86.0%, but **EmergenceMem Internal is closed-source SaaS at [emergence.ai/web-automation-api](https://www.emergence.ai/web-automation-api) — it is not a library you can install, fork, self-host, or audit**. Their public reference repo `emergence_simple_fast` ships with **no LICENSE file** (default copyright applies; publicly readable but not legally redistributable). AgentOS ships the full architecture under [Apache-2.0](https://github.com/framerslab/agentos/blob/master/LICENSE) — install, fork, redistribute, embed in commercial products without restriction or fee.

**Cost**: $/correct is a run's total cost divided by its correct answers. The Simple Fast run records its judge cost apart from its total, so its row gives both figures: $0.0581 for reader tokens and $0.0587 with judge tokens.

### Why other Mastra and managed-platform numbers are not in this table

- **Mastra OM 94.9%** uses gpt-5-mini reader + gemini-2.5-flash observer (cross-provider). Their public methodology page does not include enough detail to reproduce the result; we cannot independently verify it.
- **Mem0 94.4%** is the LongMemEval overall score on [Mem0's evaluation page](https://docs.mem0.ai/core-concepts/memory-evaluation) (read 9 November 2026), for its managed platform at a top_200 retrieval budget. Reader not named; the page names no judge model and does not say whether the run used LongMemEval-S or LongMemEval-M.
- **Hindsight 91.4%** uses `gemini-3-pro` reader (cross-provider).
- **Supermemory 85.2%** uses `gemini-3-pro` reader (cross-provider).
- **agentmemory 96.2%** has no published CI, no methodology breakdown.

## LongMemEval-M Phase B (1.5M tokens, 500 sessions per haystack)

The harder variant. An M haystack runs to about 1.5M tokens, far past GPT-4o's 128K-token context window, so a `gpt-4o` reader cannot take the whole haystack. Most memory vendors stop at S because raw long-context fits there.

| System | Accuracy | License | Source |
|---|---:|---|---|
| AgentBrain | 71.7% (Test 0) | closed-source SaaS, requires hosted endpoint | [github.com/AgentBrainHQ](https://github.com/AgentBrainHQ) |
| LongMemEval paper, strongest GPT-4o (round, Top-10) | 72.0% | open repo | [Wu et al. ICLR 2025, Table 3](https://arxiv.org/abs/2410.10813) |
| LongMemEval paper, GPT-4o session Top-5 | 71.4% | open repo | [Wu et al. ICLR 2025, Table 3](https://arxiv.org/abs/2410.10813) |
| LongMemEval paper, GPT-4o round Top-5 | 65.7% | open repo | [Wu et al. ICLR 2025, Table 3](https://arxiv.org/abs/2410.10813) |
| Mem0 | variant not named | Apache 2.0 for the open-source SDK; the 94.4% is from the managed platform | [docs.mem0.ai](https://docs.mem0.ai/core-concepts/memory-evaluation): 94.4% overall, LongMemEval variant and reader not named |
| Mastra OM | not published | Apache 2.0 | reports S only |
| Hindsight | not published | open repo | reports S only |
| Zep | not published | Apache 2.0 | "due to gpt-4o's 128K context window we chose S over M" |
| EmergenceMem | not published | **closed-source SaaS** (Internal); **no license** (Simple Fast public repo) | reports S only |
| Supermemory | not published | open | reports S only |
| MemMachine, Memoria, agentmemory, Backboard, ByteRover, Letta, Cognee | not published | various | reports S only or no LongMemEval |

The AgentOS LongMemEval-M result is being re-run without a remote reranker. The strongest GPT-4o result in the LongMemEval paper is 72.0% at round-level Top-10. The closest published external number is AgentBrain's 71.7% from their closed-source SaaS.

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

The AgentOS LongMemEval results are being re-run without a remote reranker, and the commands that reproduce them will be published with them. The runner is open source:

```bash
git clone https://github.com/framerslab/agentos-bench
cd agentos-bench
pnpm install && pnpm build

# Download LongMemEval-S into data/longmemeval/longmemeval_s.json
node dist/cli.js setup --benchmark longmemeval-s
```

Each run writes a per-case run JSON under `results/runs/`. `--seed 42` fixes the bootstrap resampling behind the confidence intervals; without `--seed` the resampling draws from `Math.random`, so the intervals differ from run to run. The bench leaderboard at [`results/LEADERBOARD.md`](https://github.com/framerslab/agentos-bench/blob/master/results/LEADERBOARD.md) in agentos-bench records earlier runs, among them the runs that used a remote reranker; its AgentOS LongMemEval figures are not the current results.

## Related blog posts

- [Memory Benchmark Transparency: Why LongMemEval and LOCOMO Numbers Don't Compare](https://agentos.sh/en/blog/memory-benchmark-transparency-audit) — the 12-axis methodology audit
- [Cognitive Memory architecture (docs)](/features/cognitive-memory) — the 8 neuroscience-backed mechanisms behind the retrieval stack

## References

- Wu et al., LongMemEval (ICLR 2025). [arXiv:2410.10813](https://arxiv.org/abs/2410.10813).
- Maharana et al., LOCOMO (ACL 2024). [aclanthology.org](https://aclanthology.org/2024.acl-long.747.pdf).
- Penfield Labs LOCOMO audit (April 2026). [dev.to/penfieldlabs](https://dev.to/penfieldlabs/we-audited-locomo-64-of-the-answer-key-is-wrong-and-the-judge-accepts-up-to-63-of-intentionally-33lg).
- Sumers et al., CoALA (cognitive architectures for language agents). [arXiv:2309.02427](https://arxiv.org/abs/2309.02427).
- Packer et al., MemGPT. [arXiv:2310.08560](https://arxiv.org/abs/2310.08560). Now part of [Letta](https://www.letta.com/blog/memgpt-and-letta).
- Northcutt et al., Pervasive label errors in test sets (NeurIPS 2021). [arXiv:2103.14749](https://arxiv.org/abs/2103.14749).
