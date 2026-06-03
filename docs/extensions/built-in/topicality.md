---
title: "Topicality"
sidebar_position: 17.2
displayed_sidebar: guideSidebar
---

Embedding-based topic enforcement with allowed/forbidden topic boundaries and session-aware drift detection via exponential moving average tracking.

**Package:** `@framers/agentos-ext-topicality`

---

## Overview

The Topicality extension provides two modes of operation:

- **Passive protection** via a built-in guardrail that automatically enforces topic boundaries on user input using semantic embedding similarity
- **Active capability** via an agent-callable tool (`check_topic`) for on-demand topic matching

It enforces:

- **Allowed topics** -- messages must be semantically related to at least one configured allowed topic (off-topic messages are flagged or blocked)
- **Forbidden topics** -- messages matching a forbidden topic above the threshold are immediately blocked
- **Drift detection** -- gradual off-topic steering across multiple conversation turns is detected using per-session exponential moving average (EMA) tracking

Topics are defined as structured descriptors with name, description, and example phrases. Each topic is embedded as a centroid vector (average of all example embeddings) for broad semantic coverage across different phrasings.

---

## Installation

```bash
npm install @framers/agentos-ext-topicality
```

Requires an embedding provider to be configured in AgentOS (e.g., OpenAI embeddings via [`AIModelProviderManager`](https://github.com/framerslab/agentos/blob/master/src/core/llm/providers/AIModelProviderManager.ts)), or a custom `embeddingFn` can be injected for testing.

---

## Usage

### Direct factory usage

```typescript
import { AgentOS } from '@framers/agentos';
import { createTopicalityGuardrail, TOPIC_PRESETS } from '@framers/agentos-ext-topicality';

const topicalityPack = createTopicalityGuardrail({
  allowedTopics: TOPIC_PRESETS.customerSupport,
  forbiddenTopics: TOPIC_PRESETS.commonUnsafe,
  allowedThreshold: 0.35,
  forbiddenThreshold: 0.65,
  offTopicAction: 'flag',
  forbiddenAction: 'block',
  enableDriftDetection: true,
});

const agent = new AgentOS();
await agent.initialize({
  ...config,
  manifest: { packs: [{ factory: () => topicalityPack }] },
});
```

### Manifest-based loading

```typescript
await agent.initialize({
  manifest: {
    packs: [
      {
        package: '@framers/agentos-ext-topicality',
        options: {
          allowedTopics: [
            {
              id: 'billing',
              name: 'Billing & Payments',
              description: 'Questions about charges, invoices, payments, refunds',
              examples: ['why was I charged twice?', 'can I get a refund?'],
            },
          ],
          forbiddenTopics: [],
        },
      },
    ],
  },
});
```

---

## TopicDescriptor

Topics are defined as structured descriptors. The embedding strategy computes a centroid (average vector) of embeddings for `[description, ...examples]`, giving broad semantic coverage across different phrasings of the same topic.

```typescript
interface TopicDescriptor {
  /** Machine-readable identifier (e.g., 'billing', 'tech-support') */
  id: string;
  /** Human-readable name (e.g., 'Billing & Payments') */
  name: string;
  /** What this topic covers (1-2 sentences) */
  description: string;
  /** 3-5 example messages that fall under this topic */
  examples: string[];
}
```

Example:

```typescript
const billingTopic: TopicDescriptor = {
  id: 'billing',
  name: 'Billing & Payments',
  description: 'Questions about charges, invoices, payments, refunds, and subscription management',
  examples: [
    'why was I charged twice?',
    'can I get a refund?',
    'how do I update my payment method?',
    'what does my invoice include?',
  ],
};
```

---

## TopicEmbeddingIndex

The [`TopicEmbeddingIndex`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/safety/topicality/src/TopicEmbeddingIndex.ts) pre-computes embeddings for all topic descriptors. Built lazily on first evaluation:

1. Embed `[description, ...examples]` as a batch for each topic
2. Compute centroid (component-wise average) of all embeddings per topic
3. Store as `{ descriptor, centroid }` for fast cosine comparison

On query, the input text is embedded and compared against all topic centroids via cosine similarity. Results are sorted by similarity descending.

The centroid approach gives better coverage than embedding a single description string -- the examples anchor different phrasings and intents within the same topic.

---

## TopicDriftTracker

The [`TopicDriftTracker`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/safety/topicality/src/TopicDriftTracker.ts) detects gradual off-topic steering across multiple conversation turns using an exponential moving average (EMA) of message embeddings.

### EMA Formula

```
First message:  running_embedding = message_embedding
Subsequent:     running_embedding = alpha * message_embedding + (1 - alpha) * running_embedding
```

Where `alpha` (default 0.3) controls how much weight is given to recent messages. Higher alpha = more weight on the latest message.

### Drift Detection

After each EMA update, the running embedding is compared against all allowed topic centroids:

1. If the nearest allowed topic similarity is below `driftThreshold` (default 0.3), the `driftStreak` counter increments
2. If the streak exceeds `driftStreakLimit` (default 3), a drift action is triggered

This catches gradual off-topic steering where each individual message might pass single-message topic checks, but the conversation trajectory is drifting away from allowed topics.

### Per-Session State

| Field              | Description                                       |
| ------------------ | ------------------------------------------------- |
| `runningEmbedding` | EMA of message embeddings                         |
| `messageCount`     | Messages contributed to the average               |
| `lastTopicScore`   | Last computed similarity to nearest allowed topic |
| `driftStreak`      | Consecutive messages below drift threshold        |
| `lastSeenAt`       | Timestamp for stale cleanup                       |

Sessions are cleaned up lazily when the session map exceeds `maxSessions` (default 100) entries or after `sessionTimeoutMs` (default 1 hour) of inactivity.

---

## Preset Libraries

The extension ships with pre-built topic descriptor sets for common use cases:

### `TOPIC_PRESETS.customerSupport`

5 topics: Billing & Payments, Technical Support, Account Management, Product Information, Shipping & Delivery.

### `TOPIC_PRESETS.codingAssistant`

4 topics: Programming, Debugging, Software Architecture, DevOps & Deployment.

### `TOPIC_PRESETS.commonUnsafe`

3 forbidden topics: Violence & Harm, Illegal Activity, Self-Harm.

```typescript
import { createTopicalityGuardrail, TOPIC_PRESETS } from '@framers/agentos-ext-topicality';

const pack = createTopicalityGuardrail({
  allowedTopics: TOPIC_PRESETS.customerSupport,
  forbiddenTopics: TOPIC_PRESETS.commonUnsafe,
});
```

---

## Configuration

### `TopicalityPackOptions`

| Option                 | Type                                       | Default   | Description                                                                                                                  |
| ---------------------- | ------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `allowedTopics`        | `TopicDescriptor[]`                        | —         | Topics the agent IS allowed to discuss. If omitted, no allowed-topic filtering is performed.                                 |
| `forbiddenTopics`      | `TopicDescriptor[]`                        | —         | Topics the agent must NOT discuss.                                                                                           |
| `allowedThreshold`     | `number`                                   | `0.35`    | Cosine similarity threshold for matching allowed topics. Messages below this to ALL allowed topics are considered off-topic. |
| `forbiddenThreshold`   | `number`                                   | `0.65`    | Cosine similarity threshold for matching forbidden topics. Messages above this to ANY forbidden topic are blocked.           |
| `offTopicAction`       | `'flag' \| 'block'`                        | `'flag'`  | Action when a message is off-topic.                                                                                          |
| `forbiddenAction`      | `'flag' \| 'block'`                        | `'block'` | Action when a message matches a forbidden topic.                                                                             |
| `enableDriftDetection` | `boolean`                                  | `true`    | Enable session-aware topic drift detection.                                                                                  |
| `drift`                | `Partial<DriftConfig>`                     | —         | Drift detection configuration overrides.                                                                                     |
| `embeddingFn`          | `(texts: string[]) => Promise<number[][]>` | —         | Custom embedding function. If omitted, resolves [`EmbeddingManager`](https://github.com/framerslab/agentos/blob/master/src/cognition/rag/EmbeddingManager.ts) from [`ISharedServiceRegistry`](https://github.com/framerslab/agentos/blob/master/src/extensions/ISharedServiceRegistry.ts).                            |
| `guardrailScope`       | `'input' \| 'output' \| 'both'`            | `'input'` | Defaults to input-only because topicality checks user messages, not agent responses.                                         |

### `DriftConfig`

| Option             | Type     | Default            | Description                                                                         |
| ------------------ | -------- | ------------------ | ----------------------------------------------------------------------------------- |
| `alpha`            | `number` | `0.3`              | EMA smoothing factor. Higher = more weight on recent messages. Range: 0.0--1.0.     |
| `driftThreshold`   | `number` | `0.3`              | Similarity below which a message's running average is considered drifting.          |
| `driftStreakLimit` | `number` | `3`                | Consecutive drifting messages before triggering the drift action.                   |
| `sessionTimeoutMs` | `number` | `3600000` (1 hour) | Session state timeout. Stale sessions are cleaned up.                               |
| `maxSessions`      | `number` | `100`              | Maximum concurrent session states. When exceeded, stale sessions are pruned lazily. |

---

## Agent Tools

### `check_topic`

On-demand topic matching tool. Lets agents proactively check text against configured topics.

```
Agent: Let me verify this is on-topic before processing.
-> check_topic({ text: "how do I update my credit card?" })
<- {
    onTopic: true,
    nearestTopic: { topicId: 'billing', topicName: 'Billing & Payments', similarity: 0.82 },
    forbiddenMatch: null,
    allScores: [...],
    driftStatus: null
  }
```

---

## Reason Codes

The guardrail returns machine-readable reason codes for analytics:

| Reason Code            | Trigger                                        | Metadata                                                      |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `TOPICALITY_FORBIDDEN` | Message matches a forbidden topic              | `matchedTopic: { topicId, topicName, similarity }`            |
| `TOPICALITY_OFF_TOPIC` | Message below allowed threshold for all topics | `nearestTopic: { topicId, topicName, similarity }, threshold` |
| `TOPICALITY_DRIFT`     | Drift streak exceeded limit                    | `driftStreak, currentSimilarity, nearestTopic`                |

---

## Memory Impact

| Component                   | Memory                             | When Loaded                   |
| --------------------------- | ---------------------------------- | ----------------------------- |
| Topic centroid embeddings   | ~50KB per topic (1536-dim)         | First evaluation (lazy build) |
| TopicDriftTracker state     | ~12KB per active session           | First message per session     |
| EmbeddingManager            | Shared (already loaded by AgentOS) | --                            |
| **10 topics, 100 sessions** | **~1.7MB**                         | --                            |

---

## Graceful Degradation

| Condition                                 | Behavior                                         |
| ----------------------------------------- | ------------------------------------------------ |
| No embedding provider configured          | Pack logs warning, all messages pass (fail-open) |
| Embedding API call fails                  | That evaluation skipped, message passes          |
| No allowed or forbidden topics configured | Guardrail is a no-op (returns null)              |
| Session map exceeds 100 entries           | `pruneStale()` cleans up lazily                  |
| `embeddingFn` throws                      | Logged, fail-open for that message               |

---

## Related Documentation

- [Guardrails](/features/guardrails)
- [Extension Architecture](/extensions/extension-architecture)
- [Extensions Overview](/extensions)
- [PII Redaction](/extensions/built-in/pii-redaction)
- [ML Content Classifiers](/extensions/built-in/ml-classifiers)
- [Code Safety](/extensions/built-in/code-safety)
- [Grounding Guard](/extensions/built-in/grounding-guard)
