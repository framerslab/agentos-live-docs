---
title: 'Topicality'
sidebar_position: 20
---

# Topicality

Topic enforcement for user input: a message that matches a blocked topic is blocked, and one that matches no allowed topic is flagged. Matching runs on local sentence embeddings, an LLM judge, or substring keywords, in that order.

**Package:** `@framers/agentos-ext-topicality` (this page describes 0.2.2)

---

## Overview

The Topicality extension provides two modes of operation:

- **Passive protection** via a guardrail that checks the user's text input (`evaluateInput`). It does not evaluate the agent's output or streamed chunks.
- **Active capability** via an agent-callable tool (`check_topic`) for on-demand topic checks.

Topics are short natural-language strings, such as `'billing and payments'` or `'violence'`.

### Tiers

Each message goes to the first tier that answers:

1. **Embeddings**: `@huggingface/transformers` feature extraction with `Xenova/all-MiniLM-L6-v2` (mean pooling, normalized vectors), loaded on the first message; each topic string's vector is cached. Blocked topics are checked first: a cosine similarity at or above `maxBlockedSimilarity` (0.5) is a blocked-topic hit. With no allowed topics the message passes; otherwise it passes when its best allowed-topic similarity is at or above `minSimilarity` (0.3), and is off-topic below it.
2. **LLM judge**: when the model cannot load and `llmInvoker` is set. The prompt lists the allowed and blocked topics and asks for `{ onTopic, confidence, detectedTopic }` as JSON. A failed call or a reply without JSON falls through to the keyword tier.
3. **Keywords**: case-insensitive substring matching in both directions between the message and each topic string, blocked topics first.

A model that fails to load is not tried again in the process.

### Results

| Outcome                                                         | Action  | Reason code     |
| --------------------------------------------------------------- | ------- | --------------- |
| The detected topic is one of `blockedTopics`                     | `BLOCK` | `BLOCKED_TOPIC` |
| Off-topic (no allowed topic matched, or the LLM judge said so)   | `FLAG`  | `OFF_TOPIC`     |
| On-topic, or neither list has an entry, or empty input           | none    | --              |

The metadata carries `detectedTopic`, `confidence` and `onTopic`. An LLM judge reply blocks only when its `detectedTopic` names a blocked topic exactly; otherwise an off-topic reply flags.

---

## Installation

```bash
npm install @framers/agentos-ext-topicality
```

The embedding tier needs `@huggingface/transformers` (an optional dependency of AgentOS):

```bash
npm install @huggingface/transformers
```

---

## Usage

### Direct factory usage

```typescript
import { AgentOS, generateText } from '@framers/agentos';
import { createTopicalityGuardrail } from '@framers/agentos-ext-topicality';

const topicalityPack = createTopicalityGuardrail({
  allowedTopics: ['billing and payments', 'technical support', 'account management'],
  blockedTopics: ['violence', 'illegal activity'],
  minSimilarity: 0.3,
  maxBlockedSimilarity: 0.5,
  // Used only when the embedding model cannot load.
  llmInvoker: async (prompt) =>
    (await generateText({ provider: 'openai', model: 'gpt-4o-mini', prompt })).text,
});

const agentos = await AgentOS.create({
  extensionManifest: { packs: [{ factory: () => topicalityPack }] },
});
```

### Manifest-based loading

```typescript
const agentos = await AgentOS.create({
  extensionManifest: {
    packs: [
      {
        package: '@framers/agentos-ext-topicality',
        options: {
          allowedTopics: ['billing and payments'],
          blockedTopics: [],
        },
      },
    ],
  },
});
```

Both lists are required: pass `[]` for the one you do not use.

---

## Configuration

### `TopicalityOptions`

| Option                 | Type                                  | Default  | Description                                                              |
| ---------------------- | ------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `allowedTopics`        | `string[]`                            | required | Topics the agent may discuss. `[]` places no restriction.                |
| `blockedTopics`        | `string[]`                            | required | Topics to block. Checked before the allowed topics.                      |
| `minSimilarity`        | `number`                              | `0.3`    | Lowest best allowed-topic similarity (inclusive) for an on-topic message. |
| `maxBlockedSimilarity` | `number`                              | `0.5`    | Similarity (inclusive) to a blocked topic that blocks the message.       |
| `llmInvoker`           | `(prompt: string) => Promise<string>` | —        | LLM judge used when the embedding model cannot load.                     |

---

## Agent Tools

### `check_topic`

On-demand topic check through the same guardrail.

```
Agent: Let me verify this is on-topic before processing.
-> check_topic({ text: "how do I update my credit card?" })
<- output: { onTopic: true, confidence: 1, detectedTopic: 'allowed' }
```

An on-topic message returns `confidence: 1` and `detectedTopic: 'allowed'`; an off-topic one returns the guardrail's confidence and detected topic.

---

## Graceful Degradation

| Condition                                                        | Behavior                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| `@huggingface/transformers` not installed, or the model fails to load | The embedding tier is skipped from then on; the LLM judge or keywords decide |
| LLM call fails or returns no JSON                                | The keyword tier decides                                         |
| Both topic lists empty                                           | No result                                                        |
| Empty input                                                      | No result                                                        |

---

## Related Documentation

- [Guardrails](/features/guardrails)
- [Extension Architecture](/extensions/extension-architecture)
- [Extensions Overview](/extensions)
- [PII Redaction](/extensions/built-in/pii-redaction)
- [ML Content Classifiers](/extensions/built-in/ml-classifiers)
- [Code Safety](/extensions/built-in/code-safety)
- [Grounding Guard](/extensions/built-in/grounding-guard)
