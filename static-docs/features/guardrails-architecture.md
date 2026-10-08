---
title: 'Guardrails Architecture'
description: 'AgentOS guardrails internals — input/output dispatcher, ALLOW/SANITIZE/BLOCK/FLAG verdicts, two-phase scanning, fail-open and fail-closed semantics'
keywords:
  - llm guardrails
  - agent guardrails
  - input output filtering
  - prompt injection defense
  - pii redaction
  - sanitize block flag
  - two phase guardrails
  - grounding guard
  - topicality
  - fail open fail closed
sidebar_position: 7
---

# Guardrails Architecture

The guardrail system runs every user message, and the stream `processRequest()` returns, through a two-phase dispatcher. Input guardrails run before the orchestrator sees the message. Output guardrails run on the chunks of that stream before they reach the client: every guardrail evaluates the chunks that carry `isFinal: true` (the `FINAL_RESPONSE`, an `ERROR`), a guardrail with `evaluateStreamingChunks: true` also evaluates each `TEXT_DELTA`, and every other chunk passes through unevaluated. Each guardrail returns one of four verdicts (`ALLOW`, `SANITIZE`, `BLOCK`, `FLAG`), and the dispatcher composes them in a fixed order. A guardrail that throws, or runs past its `timeoutMs`, is skipped with a logged warning; with `failClosed: true` in its config, it blocks instead.

This page documents the internals. For recipe-style usage of the shipped guardrail packs (PII, ML classifiers, topicality, code safety, grounding), see [Guardrails System](/features/guardrails).

---

## Request Lifecycle

Every user message passes through the input guardrails before the orchestrator sees it. The chunks of the `processRequest()` stream pass through the output guardrails before they reach the client. The streams that `handleToolResult()`, `handleToolResults()` and `resumeExternalToolRequest()` return, which continue a turn after an external tool call, do not pass through output guardrails.

```mermaid
flowchart LR
    A[User Input] --> B[Input Guardrails]
    B -->|BLOCK| C[Error Response]
    B -->|SANITIZE| D[Modified Input]
    B -->|ALLOW/FLAG| D
    D --> E[Orchestrator / LLM]
    E --> F[Output Stream]
    F --> G[Output Guardrails]
    G -->|BLOCK| H[Stream Terminated]
    G -->|SANITIZE| I[Modified Output]
    G -->|ALLOW/FLAG| I
    I --> J[Client]
```

The four possible verdicts are:

- **ALLOW** — content passes through unchanged.
- **SANITIZE** — content is modified in-place (e.g., PII replaced with `[PERSON]`) and the modified version continues downstream.
- **BLOCK** — content is rejected. For input, an error response is returned immediately. For output, the dispatcher yields one `ERROR` chunk, whose code is the guardrail's `reasonCode` or `GUARDRAIL_BLOCKED`, and the stream ends.
- **FLAG** — content passes through unchanged, but metadata is attached for downstream logging and auditing.

---

## Two-Phase Parallel Execution

The dispatcher splits registered guardrails into two phases based on whether they can modify content (`canSanitize`). Sanitizers must run sequentially (each one's output feeds the next). Non-sanitizing guardrails run in parallel for maximum throughput.

```mermaid
flowchart TD
    A[All Registered Guardrails] --> B{canSanitize?}
    B -->|true| C[Phase 1: Sequential]
    B -->|false| D[Phase 2: Parallel]

    C --> C1[PII Redaction]
    C1 -->|sanitized text| C2[Next Sanitizer...]
    C2 --> E[Sanitized Text]

    E --> D
    D --> D1[ML Classifiers]
    D --> D2[Topicality]
    D --> D3[Code Safety]
    D --> D4[Grounding Guard]

    D1 --> F{Worst Wins}
    D2 --> F
    D3 --> F
    D4 --> F

    F -->|BLOCK| G[Terminate]
    F -->|FLAG| H[Pass + Log]
    F -->|ALLOW| I[Pass]
```

**Worst-wins aggregation:** if any parallel guardrail returns `BLOCK`, the final verdict is `BLOCK` regardless of what the others returned. `FLAG` wins over `ALLOW`.

---

## Streaming Chunk Lifecycle

A guardrail with `evaluateStreamingChunks: true` evaluates each `TEXT_DELTA` as it arrives, up to its `maxStreamingEvaluations`; every guardrail evaluates each chunk that carries `isFinal: true`. A `BLOCK` verdict on an evaluated chunk ends the stream with an `ERROR` chunk. `TOOL_CALL_REQUEST`, `SYSTEM_PROGRESS`, `METADATA_UPDATE` and every other chunk with `isFinal: false` pass through without evaluation.

```mermaid
sequenceDiagram
    participant Stream as processRequest() stream
    participant Dispatcher
    participant Guardrail as Guardrail with streaming evaluation
    participant Client

    Stream->>Dispatcher: TEXT_DELTA (chunk 1)
    Dispatcher->>Guardrail: evaluateOutput({chunk, ragSources})
    Guardrail-->>Dispatcher: null (allow)
    Dispatcher->>Client: TEXT_DELTA (chunk 1)

    Stream->>Dispatcher: TOOL_CALL_REQUEST, isFinal false
    Dispatcher->>Client: TOOL_CALL_REQUEST, not evaluated

    Stream->>Dispatcher: FINAL_RESPONSE, isFinal true
    Dispatcher->>Guardrail: evaluateOutput({chunk, ragSources})
    Guardrail-->>Dispatcher: FLAG
    Dispatcher->>Client: FINAL_RESPONSE + metadata.guardrail.output

    Note over Dispatcher,Client: A BLOCK on any evaluated chunk yields one ERROR chunk, and the stream ends
```

---

## Chunk Types

| Type                   | Key Fields                                                                    | When It Appears                                                                                                                  | Output guardrails                                                       |
| ---------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `TEXT_DELTA`           | `textDelta`, `isFinal: false`                                                 | Each text delta the model streams                                                                                                | Evaluated by guardrails with `evaluateStreamingChunks: true`            |
| `FINAL_RESPONSE`       | `finalResponseText`, `ragSources`, `usage`, `error`, `isFinal: true`          | The turn's response, at the end of the stream                                                                                    | Evaluated by every guardrail                                            |
| `TOOL_CALL_REQUEST`    | `toolCalls: [{id, name, arguments}]`, `executionMode`, `requiresExternalToolResult` | The model asks for tools; `processRequest()` returns after a request the host must execute (`executionMode: 'external'`) | Not evaluated                                                           |
| `TOOL_RESULT_EMISSION` | `toolCallId`, `toolName`, `toolResult`, `isSuccess`, `errorMessage`           | The result of an external tool call, when the host returns it; results of tools the runtime runs itself are not on this stream  | Not evaluated: it arrives on the streams that continue the turn, which skip output guardrails |
| `SYSTEM_PROGRESS`      | `message`, `progressPercentage`                                               | Status updates                                                                                                                   | Not evaluated                                                           |
| `ERROR`                | `code`, `message`, `isFinal: true`                                            | An error, a guardrail block included                                                                                             | Evaluated by every guardrail, except the `ERROR` a block produces       |

---

## Memory Budget

All models lazy-load on first use. Nothing is loaded until a guardrail actually evaluates content.

| Pack            | Idle      | Active     | What Loads                            |
| --------------- | --------- | ---------- | ------------------------------------- |
| PII Redaction   | 0         | ~115MB     | OpenRedaction + compromise + BERT NER |
| ML Classifiers  | 0         | ~98MB      | toxic-bert + DeBERTa + PromptGuard    |
| Topicality      | 0         | ~1.7MB     | Topic centroid embeddings             |
| Code Safety     | ~10KB     | ~10KB      | Compiled regex (always loaded)        |
| Grounding Guard | 0         | ~40MB      | NLI cross-encoder                     |
| **Combined**    | **~10KB** | **~255MB** | Only if ALL packs + ALL tiers active  |

---

## Related Documentation

- [Guardrails Overview](/features/guardrails)
- [Creating Custom Guardrails](/features/creating-guardrails)
- [PII Redaction](/extensions/built-in/pii-redaction)
- [ML Classifiers](/extensions/built-in/ml-classifiers)
- [Grounding Guard](/extensions/built-in/grounding-guard)
- [Safety Primitives](/features/safety-primitives)

---

## References

### LLM safety surveys

- Wei, A., Haghtalab, N., & Steinhardt, J. (2023). *Jailbroken: How does LLM safety training fail?* NeurIPS 2023. — Foundational analysis of why prompt-injection and jailbreak attacks succeed; motivates the per-chunk evaluation model used here. [arXiv:2307.02483](https://arxiv.org/abs/2307.02483)
- Greshake, K., Abdelnabi, S., Mishra, S., Endres, C., Holz, T., & Fritz, M. (2023). *Not what you've signed up for: Compromising real-world LLM-integrated applications with indirect prompt injection.* AISec '23. — Indirect prompt injection threat model the input-side guardrails defend against. [arXiv:2302.12173](https://arxiv.org/abs/2302.12173)

### Toxicity + harm classification

- Hartvigsen, T., Gabriel, S., Palangi, H., Sap, M., Ray, D., & Kamar, E. (2022). *ToxiGen: A large-scale machine-generated dataset for adversarial and implicit hate speech detection.* ACL 2022. — Training-data foundation for the ML classifier pack's toxicity probes. [arXiv:2203.09509](https://arxiv.org/abs/2203.09509)
- Markov, T., Zhang, C., Agarwal, S., Eloundou, T., Lee, T., Adler, S., Jiang, A., & Weng, L. (2023). *A holistic approach to undesired content detection in the real world.* AAAI 2023. — OpenAI's content-classifier methodology; informs the multi-category labeling approach in the ml-classifiers pack. [arXiv:2208.03274](https://arxiv.org/abs/2208.03274)

### PII detection

- Pilán, I., Lison, P., Øvrelid, L., Papadopoulou, A., Sánchez, D., & Batet, M. (2022). *The Text Anonymization Benchmark (TAB): A dedicated corpus and evaluation framework for text anonymization.* *Computational Linguistics*, 48(4), 1053–1101. — Evaluation methodology for the pii-redaction sanitizer. [arXiv:2202.00443](https://arxiv.org/abs/2202.00443)

### Grounding / hallucination detection

- Ji, Z., Lee, N., Frieske, R., Yu, T., Su, D., Xu, Y., Ishii, E., Bang, Y. J., Madotto, A., & Fung, P. (2023). *Survey of hallucination in natural language generation.* *ACM Computing Surveys*, 55(12), 1–38. — Survey of hallucination types the grounding-guard pack targets. [arXiv:2202.03629](https://arxiv.org/abs/2202.03629)
- Min, S., Krishna, K., Lyu, X., Lewis, M., Yih, W.-t., Koh, P. W., Iyyer, M., Zettlemoyer, L., & Hajishirzi, H. (2023). *FactScore: Fine-grained atomic evaluation of factual precision in long form text generation.* EMNLP 2023. — Atomic-fact verification methodology behind grounding-guard's per-claim source-attribution check. [arXiv:2305.14251](https://arxiv.org/abs/2305.14251)

### Streaming guardrails

- Bai, Y., Jones, A., Ndousse, K., Askell, A., Chen, A., DasSarma, N., Drain, D., Fort, S., Ganguli, D., Henighan, T., Joseph, N., Kadavath, S., Kernion, J., Conerly, T., El-Showk, S., Elhage, N., Hatfield-Dodds, Z., Hernandez, D., Hume, T., ... Kaplan, J. (2022). *Constitutional AI: Harmlessness from AI feedback.* arXiv preprint. — Critique-and-revise pattern that informs the content-policy-rewriter pack's sanitize-rather-than-block design. [arXiv:2212.08073](https://arxiv.org/abs/2212.08073)

### Implementation references

- [`packages/agentos/src/safety/guardrails/`](https://github.com/framerslab/agentos/tree/master/src/safety/guardrails) — [`IGuardrailService`](https://github.com/framerslab/agentos/blob/master/src/safety/guardrails/IGuardrailService.ts), [`ParallelGuardrailDispatcher`](https://github.com/framerslab/agentos/blob/master/src/safety/guardrails/ParallelGuardrailDispatcher.ts), [`GuardrailAction`](https://github.com/framerslab/agentos/blob/master/src/safety/guardrails/IGuardrailService.ts)
- [`packages/agentos-extensions/registry/curated/safety/`](https://github.com/framerslab/agentos-extensions/tree/master/registry/curated/safety) — six built-in packs: `pii-redaction`, `ml-classifiers`, `topicality`, `code-safety`, `grounding-guard`, `content-policy-rewriter`
- [`packages/agentos/src/safety/runtime/`](https://github.com/framerslab/agentos/tree/master/src/safety/runtime) — [`CircuitBreaker`](https://github.com/framerslab/agentos/blob/master/src/safety/runtime/CircuitBreaker.ts), [`CostGuard`](https://github.com/framerslab/agentos/blob/master/src/safety/runtime/CostGuard.ts), [`StuckDetector`](https://github.com/framerslab/agentos/blob/master/src/safety/runtime/StuckDetector.ts) (the runtime safety supervisor primitives that compose with the guardrail layer)
