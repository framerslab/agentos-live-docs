---
title: "Documentation Index"
sidebar_position: 1
displayed_sidebar: guideSidebar
---

---

## Documentation Index

### Getting Started

- [**Getting Started Guide**](/getting-started) — Install, env setup, and 3 levels (1 line → 3 lines → 5 lines)
- [**README**](/getting-started/documentation-index) — Installation and quick start
- [**High-Level API**](/getting-started/high-level-api) — `generateText()`, `streamText()`, `generateImage()`, `generateVideo()`, `analyzeVideo()`, `generateMusic()`, `generateSFX()`, `performOCR()`, `agent()`, and `agency()`
- [**Examples Cookbook**](/getting-started/examples) — 12 complete runnable examples, including QueryRouter host hooks and finalized agency streaming
- [**CHANGELOG**](/getting-started/changelog) — Version history and release notes

### Architecture & Core Concepts

- [**Architecture Overview**](/architecture/system-architecture) — Complete system architecture and design principles

### Features & Capabilities

#### Planning & Orchestration

- [**Orchestration Guide**](/features/orchestration-guide) — Graphs, workflows, missions, voice nodes, checkpointing, YAML authoring
- [**Unified Orchestration Layer**](/features/unified-orchestration) — One runtime, three authoring APIs ([`AgentGraph`](https://github.com/framerslab/agentos/blob/master/src/orchestration/builders/AgentGraph.ts), `workflow()`, `mission()`)
- [**AgentGraph**](/features/agent-graph) — Full graph builder with typed nodes, conditional edges, and subgraphs
- [**workflow() DSL**](/features/workflow-dsl) — Deterministic DAG pipelines with branching and parallel joins
- [**mission() API**](/features/mission-api) — Goal-first orchestration driven by the PlanningEngine
- [**Checkpointing**](/features/checkpointing) — Resume, fork, replay, and memory consistency semantics
- [**Planning Engine**](/features/planning-engine) — Multi-step task planning and execution
- [**Human-in-the-Loop**](/features/human-in-the-loop) — Approval workflows and human oversight
- [**Agent Communication**](/features/agent-communication) — Inter-agent messaging and coordination

#### Safety & Security

- [**Guardrails System**](/features/guardrails) — Two-phase guardrail dispatch, built-in packs (PII, ML classifiers, topicality, code safety, grounding), and folder-level filesystem permissions
- [**Safety Primitives**](/features/safety-primitives) — Circuit breakers, cost guards, stuck detection, and tool execution guards

#### Memory & Storage

- [**Cognitive Memory**](/features/cognitive-memory) — Personality-modulated memory with Ebbinghaus decay, Baddeley's working memory, spreading activation, HEXACO-driven encoding, and the consolidation loop
- [**RAG Memory Configuration**](/features/rag-memory) — Vector storage and retrieval setup
- [**SQL Storage Quickstart**](/features/sql-storage) — Database integration guide
- [**Client-Side Storage**](/features/client-side-storage) — Browser-based persistence
- [**Immutable Agents**](/features/immutable-agents) — Sealing lifecycle, toolset pinning, secret rotation, and soft-forget
- [**Provenance Guide**](/features/provenance-guide) — HashChain, ChainVerifier, BundleExporter, proof levels, external anchors
- [**Provenance & Immutability**](/features/provenance-immutability) — Sealed storage policy, signed ledger, and anchoring

#### AI & LLM

- [**Structured Output**](/features/structured-output) — JSON schema validation and structured generation
- [**Streaming Semantics**](/architecture/streaming-semantics) — Raw live chunks vs finalized approved output across `textStream`, `fullStream`, `text`, and `finalTextStream`
- [**Evaluation Guide**](/features/evaluation-guide) — Test cases, graders, LLM-as-judge, A/B testing, experiment tracking
- [**Evaluation Framework**](/features/evaluation-framework) — Testing, scoring, and quality assurance
- [**Query Router**](/features/query-routing) — Tiered query classification, retrieval routing, keyword fallback, and grounded answer generation
- [**Image Generation Guide**](/features/image-generation) — Provider-agnostic image generation across cloud and local backends
- [**Capability Discovery Guide**](/features/discovery-guide) — Three-tier semantic discovery, CAPABILITY.yaml, meta-tool
- [**Capability Discovery**](/features/capability-discovery) — Full architecture reference
- [**Cost Optimization**](/features/cost-optimization) — Token usage and API cost management

#### Extensions & Customization

- [**RFC Extension Standards**](/extensions/extension-standards) — Extension development guidelines
- [**Recursive Self-Building Agents**](/features/recursive-self-building) — Advanced agent patterns
- [**Skills (SKILL.md)**](/skills/skill-format) — Prompt modules loaded from directories/registries

#### Channels & Social

- [**Channels Guide**](/features/channels) — Multi-channel adapters with setup for Discord, Slack, Telegram, Twitter, and WhatsApp
- [**Social Posting Guide**](/features/social-posting) — SocialPostManager, content adaptation, scheduling, analytics

### Platform & Infrastructure

- [**Platform Support**](/architecture/platform-support) — Supported environments and requirements
- [**Observability (OpenTelemetry)**](/architecture/observability) — Tracing, metrics, and log correlation/export (opt-in)
- [**Logging (Pino + OpenTelemetry)**](/architecture/logging) — Structured logs, trace correlation, and OTEL LogRecord export (opt-in)

### Ecosystem

- [**Ecosystem**](/getting-started/ecosystem) — Related packages, extensions, and resources
- [**Releasing**](/getting-started/releasing) — Automated release process

### API Reference

- [**TypeDoc API**](/api/) — Auto-generated API documentation

---

## Quick Links

| Resource    | Link                                                                   |
| ----------- | ---------------------------------------------------------------------- |
| Website     | [agentos.sh](https://agentos.sh)                                       |
| GitHub      | [framerslab/agentos](https://github.com/framerslab/agentos)              |
| npm         | [@framers/agentos](https://www.npmjs.com/package/@framers/agentos)     |
| Issues      | [GitHub Issues](https://github.com/framerslab/agentos/issues)           |
| Discussions | [GitHub Discussions](https://github.com/framerslab/agentos/discussions) |

---

## How to Use This Documentation

1. **New to AgentOS?** Start with the [README](/getting-started/documentation-index) for installation and basic usage
2. **Understanding the system?** Read the [Architecture Overview](/architecture/system-architecture)
3. **Building features?** Check the relevant feature guide (Planning, HITL, Guardrails, etc.)
4. **API details?** Browse the [TypeDoc API Reference](/api/)
5. **Troubleshooting?** See [Platform Support](/architecture/platform-support)

---


