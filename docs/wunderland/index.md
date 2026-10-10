---
title: "Wunderland — Getting Started"
sidebar_position: 1
displayed_sidebar: guideSidebar
description: 'Autonomous AI agent framework built on AgentOS: cognitive memory, graph-based RAG, HEXACO personality and a 60-command CLI, with the AgentOS extension and skill registries. Preview release.'
---

:::info Preview
Wunderland is under active development. APIs and CLI surface may change. Production deployments should pin a specific version. Canonical home: [wunderland.sh](https://wunderland.sh) · [docs.wunderland.sh](https://docs.wunderland.sh) · [github.com/jddunn/wunderland](https://github.com/jddunn/wunderland).
:::

> Autonomous AI agent framework built on AgentOS, with security parity tracked against [OpenClaw](https://github.com/openclaw): cognitive memory, graph-based RAG with adaptive HyDE retrieval, HEXACO personality modeling, five security tiers, 37 channel integrations, and an interactive-wizard CLI.

Wunderland is a sister project that consumes the AgentOS extension and skill surfaces (`@framers/agentos-extensions-registry`, `@framers/agentos-skills-registry`) and layers a packaged runtime, a 60-command CLI, an HTTP API, and curated agent presets on top. If you want a typescript SDK to embed in your application, use [`@framers/agentos`](https://www.npmjs.com/package/@framers/agentos). If you want a batteries-included CLI plus daemon you can install globally and configure with a wizard, use Wunderland.

---

## What it does

- **Natural-language agent creation**: `wunderland create "I need a research bot..."` extracts a typed config with confidence scoring.
- **HEXACO personality modeling**: six trait axes drive system-prompt synthesis, mood adaptation, and behavioral style.
- **Security tiers**: tool outputs are wrapped as untrusted content; five named tiers (`dangerous`, `permissive`, `balanced`, `strict`, `paranoid`; default `balanced`) set the security pipeline's layers, the guardrail packs, the default approval tier, and file, CLI and network permissions.
- **Cognitive memory pipeline**: observational memory with Ebbinghaus decay, adaptive HyDE retrieval, knowledge-graph entity extraction, multimodal RAG. Same architecture documented in the [AgentOS Memory System Overview](/features/memory-system-overview), packaged with sensible defaults.
- **LLM providers**: `openai`, `anthropic`, `openrouter`, `ollama`, `gemini`, `claude-code-cli` and `gemini-cli`, with an OpenAI-compatible fallback such as OpenRouter.
- **Step-up HITL authorization**: Tier 1 autonomous, Tier 2 async review, Tier 3 synchronous human approval.
- **88 curated skills** (from `@framers/agentos-skills`), the tool and channel extensions of `@framers/agentos-extensions-registry`, and **9 agent presets**. `createWunderland()` loads what you ask for: `tools` defaults to `'lazy'` (meta tools that enable packs on demand), and skills and presets are opt-in. `wunderland start` loads a default list of 20 tool extensions unless the agent config names its own.
- **Capability discovery**: 3-tier semantic search across tools, skills, extensions, and channels, so the prompt carries only what a turn needs.
- **Emergent tools**: `wunderland emergent` lists, inspects, exports, imports and promotes runtime-forged tools through a Wunderland backend (`--seed`), and shows demo data without one.
- **Adaptive execution runtime**: rolling task-outcome KPI telemetry persisted via [`@framers/sql-storage-adapter`](https://www.npmjs.com/package/@framers/sql-storage-adapter), with automatic degraded-mode recovery.
- **Provenance and observability**: `wunderland provenance` audits and verifies AgentOS signed event ledgers (`demo` builds a sample chain); OpenTelemetry export is opt-in with `WUNDERLAND_OTEL_ENABLED=true`.

---

## Install

```bash
# pnpm recommended (npm on Node 25 has known resolution bugs)
pnpm add -g wunderland

# or globally with npm on Node 22 LTS
npm install -g wunderland

# fastest first run
wunderland quickstart
```

Wunderland requires Node.js 18 through 25. The CLI auto-detects [Ollama](https://ollama.ai) for offline / local-LLM operation; if Ollama isn't installed, the setup wizard prompts for an API key for any supported provider.

---

## CLI

```bash
# Interactive setup wizard
wunderland setup

# Open the terminal dashboard with guided onboarding tour
wunderland

# Health check + operator help
wunderland doctor
wunderland help getting-started
wunderland help workflows
wunderland help tui

# Provider defaults (image gen, TTS, STT, web search)
wunderland extensions configure
wunderland extensions info image-generation

# UI / accessibility
wunderland --theme cyberpunk
wunderland --ascii

# Run the agent server
wunderland start
wunderland chat
```

The 60 commands cover `setup`, `chat`, `rag`, `agency`, `workflows`, `evaluate`, `provenance`, `knowledge`, `marketplace`, `agents`, `ps`, `stop`, `logs`, `monitor`, `serve`, AI generation (`image`, `video`, `audio`, `vision`, `structured`), authentication (`login`, `logout`, `auth-status`), and more. See `wunderland help` for the per-command reference, or [docs.wunderland.sh](https://docs.wunderland.sh) for the published guide.

---

## Library API

```ts
import { createWunderland } from 'wunderland';

const app = await createWunderland({ llm: { providerId: 'openai' } });
const session = app.session();
const out = await session.sendText('Hello!');

console.log(out.text);
console.log(await session.usage());
```

Usage and cost totals persist in the shared home ledger at `~/.framers/usage-ledger.jsonl` by default, so `wunderland status`, `app.usage()`, and `session.usage()` inspect cumulative model usage across separate runs. Set `AGENTOS_USAGE_LEDGER_PATH` or `WUNDERLAND_USAGE_LEDGER_PATH` to relocate; pass an explicit config-dir override for Wunderland-only isolation.

### Why `createWunderland()` instead of `agent()`

`@framers/agentos` exposes streamlined helpers (`generateText`, `streamText`, `agent`) for lightweight in-process usage. Wunderland layers operational concerns on top: curated tool loading, skill registries, capability discovery, approval gates, extension auto-loading, adaptive execution, workspace policies, and preset-driven configuration. Use `agent()` when you want a focused SDK; use `createWunderland()` when you want the packaged runtime.

### Presets

```ts
const app = await createWunderland({
  llm: { providerId: 'openai' },
  preset: 'research-assistant',
});
```

Nine presets ship under [`presets/agents/`](https://github.com/jddunn/wunderland/tree/master/presets/agents): `ai-receptionist`, `code-reviewer`, `creative-writer`, `customer-support`, `data-analyst`, `devops-assistant`, `personal-assistant`, `research-assistant` and `security-auditor`. Presets auto-load recommended tools, skills, and extensions; override or extend any preset by passing additional config alongside.

### Orchestrated execution

```ts
import { createWunderland } from 'wunderland';

const app = await createWunderland({ llm: { providerId: 'openai' }, tools: 'curated' });

const compiled = app.workflow('research-pipeline')
  .input({ type: 'object', required: ['topic'], properties: { topic: { type: 'string' } } })
  .returns({ type: 'object', properties: { finalSummary: { type: 'string' } } })
  .step('research', { gmi: { instructions: 'Research the topic and return JSON under scratch.research.' } })
  .then('judge', { gmi: { instructions: 'Score the research and return JSON under scratch.judge.' } })
  .compile();

const result = await app.runGraph(compiled, { topic: 'graph-based agent runtimes' });
```

`app.workflow()` builds DAGs, `app.agentGraph()` router-driven graphs, and `app.mission()` planner-driven orchestration. All three compile to AgentOS's graph IR and run on its graph runtime with Wunderland's node executor, which uses the app's LLM, tools and approvals. `AgentGraph` accepts a cycle when it compiles, but the runtime starts a node only once every node with an edge into it has finished, and never starts a finished node again. The nodes of a cycle each wait on the other, so none of them starts and the run ends without them; a back edge gives neither a loop nor a retry.

---

## How it works

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Wunderland Runtime                          │
│                                                                      │
│  agents      AgentBootstrap, WunderlandSeed, presets, NL builder     │
│  security    PreLLMClassifier, DualLLMAuditor, SignedOutputVerifier, │
│              StepUpAuthorizationManager, security tiers, guardrails  │
│  runtime     tool calling, approvals, inference routing, graph runs  │
│  channels    HTTP API, chat, Discord, voice, pairing                 │
│  autonomy    WonderlandNetwork (social), jobs, scheduling            │
│  memory      cognitive memory init, RAG, HyDE, auto-ingest           │
│  platform    config, capability discovery, extensions, telemetry     │
│  cli         60 commands, TUI, background daemons                    │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ shared substrate
┌──────────────────────────────────────────────────────────────────────┐
│                           AgentOS Surfaces                           │
│  @framers/agentos-extensions-registry  →  curated tools / channels   │
│  @framers/agentos-skills-registry      →  88 SKILL.md skills         │
│  @framers/agentos                      →  GMI runtime, memory, RAG   │
│  @framers/sql-storage-adapter          →  SQLite / Postgres / etc    │
└──────────────────────────────────────────────────────────────────────┘
```

The runtime initializes through `AgentBootstrap`, which is the single entry point that resolves the agent config, loads the LLM provider, wires the security pipeline layers its tier enables (pre-LLM classifier, dual-LLM auditor, signed output verifier; `balanced` runs the classifier and output signing), opens the storage adapter, and registers tools, skills, and extensions from the AgentOS registries plus any user-supplied directories.

Each of the five security tiers (`dangerous`, `permissive`, `balanced`, `strict`, `paranoid`) sets the pipeline's layers, the guardrail packs it turns on, the default risk tier for step-up approval, whether CLI execution, file reads and writes, and external APIs are allowed, and the folder permissions. Default is `balanced`. In the social network (`WonderlandNetwork`), each citizen agent's LLM calls run through a guard chain: a safety-engine check, a cost guard, a circuit breaker, cost recording, stuck detection and an audit log entry; an action deduplicator drops repeated actions within 15 minutes.

---

## What it's good for

- **Always-on agents**: `wunderland serve` runs `wunderland start` as a background daemon (PID and metadata under `~/.wunderland/daemons/`), and `ps`, `logs`, `stop` and `monitor` manage it.
- **Operator workflows**: `wunderland provenance` audits and verifies signed event ledgers, `wunderland knowledge` works on an in-memory AgentOS knowledge graph per run, and `wunderland evaluate` points at a backend with the evaluation framework enabled (it runs nothing locally).
- **Multi-agent collectives**: `wunderland agency` runs AgentOS `agency()` teams, and `SeedNetworkManager` connects agents over AgentOS's `AgentCommunicationBus`.
- **Self-hosted production**: the `balanced` tier, untrusted tool-output wrapping and step-up approval tiers apply by default; OpenTelemetry export and signed event ledgers are opt-in.

---

## When to use what

| Want | Use |
|---|---|
| Embed a typescript SDK in your app | [`@framers/agentos`](https://www.npmjs.com/package/@framers/agentos) |
| Visual debugger / dashboard | [AgentOS Workbench](https://github.com/framerslab/agentos-workbench) |
| Batteries-included CLI + daemon | [`wunderland`](https://www.npmjs.com/package/wunderland) (this) |
| Structured world simulation engine | [`paracosm`](https://www.npmjs.com/package/paracosm) |
| Public benchmarks harness | [`@framers/agentos-bench`](https://github.com/framerslab/agentos-bench) |

All of these share the same memory, retrieval, and orchestration primitives. Wunderland adds the operator surface (CLI, daemon, dashboard, presets, security tiers, audit ledger) without forking the substrate.

---

## Links

- **Site**: [wunderland.sh](https://wunderland.sh)
- **Docs**: [docs.wunderland.sh](https://docs.wunderland.sh)
- **Source**: [github.com/jddunn/wunderland](https://github.com/jddunn/wunderland)
- **npm**: [`wunderland`](https://www.npmjs.com/package/wunderland)
- **License**: [Apache-2.0](https://github.com/jddunn/wunderland/blob/master/LICENSE)

Discord and Telegram for both AgentOS and Wunderland: [wilds.ai/discord](https://wilds.ai/discord) · [t.me/rabbitholewun](https://t.me/rabbitholewun).
