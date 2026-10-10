---
title: 'PII Redaction'
sidebar_position: 18
---

# PII Redaction

Detection and redaction of personally identifiable information through four tiers: regex patterns, an NLP pre-filter, an NER model and an optional LLM judge. A guardrail scrubs agent inputs and outputs, two tools let an agent scan or redact text on purpose, and `redactPii()` redacts any string in your own code.

**Package:** `@framers/agentos-ext-pii-redaction` (this page describes 0.3.1)

---

## Overview

The pack holds three descriptors:

- **The guardrail** `pii-redaction-guardrail`, which answers with a `SANITIZE` result carrying the redacted text
- **The tools** `pii_scan` and `pii_redact`, for deliberate, on-demand handling

It detects:

- **Structured PII** through [openredaction](https://www.npmjs.com/package/openredaction)'s patterns: emails, phone numbers, SSNs, card numbers, IBANs, API keys and tokens, AWS keys, US and UK passports and driving licences, government IDs (US tax IDs and ITINs, UK National Insurance and NHS numbers, Canadian SINs), IP addresses, dates of birth, crypto addresses and names
- **Unstructured PII**: person names, organisations and locations through the NLP and NER tiers

---

## Installation

```bash
npm install @framers/agentos-ext-pii-redaction
```

`openredaction`, `compromise` and `@huggingface/transformers` are optional dependencies of the package, installed with it unless optional dependencies are skipped. Without `openredaction`, detection throws; without `compromise` or `@huggingface/transformers`, their tiers are skipped. The LLM judge needs no extra package. Peer dependency: `@framers/agentos` 0.12.0 or later.

---

## Usage

### Redact a string

```typescript
import { redactPii } from '@framers/agentos-ext-pii-redaction';

const result = await redactPii('Write to sam@mail.invalid or call +1 415 555 0100 about the 1919 treaty.');
// result.found: true
// result.types: ['EMAIL', 'PHONE']
// result.text:  the sentence with [EMAIL] and [PHONE] in place of the address and the number
```

With no options, `redactPii()` looks for the regex tier's types (`REGEX_TIER_TYPES`: `EMAIL`, `PHONE`, `SSN`, `CREDIT_CARD`, `IBAN`, `API_KEY`, `AWS_KEY`, `GOV_ID`, `PASSPORT`, `DRIVERS_LICENSE`, `IP_ADDRESS`) with the NER model off, so no model loads and names stay as they are. Its options are `entityTypes`, `redactionStyle`, `enableNerModel` (default `false`) and `pipeline` (any other pack option below). It builds one pipeline per set of options and reuses it, and it throws when detection fails, for example when `openredaction` is missing. openredaction leaves addresses at documentation domains such as `example.com` in the text.

### The guardrail and tools in AgentOS

```typescript
import { AgentOS } from '@framers/agentos';
import { createPiiRedactionGuardrail } from '@framers/agentos-ext-pii-redaction';

const agentos = await AgentOS.create({
  extensionManifest: {
    packs: [
      {
        factory: () =>
          createPiiRedactionGuardrail({
            entityTypes: ['EMAIL', 'PHONE', 'SSN', 'PERSON', 'CREDIT_CARD'],
            redactionStyle: 'placeholder',
          }),
      },
    ],
  },
});
```

### Manifest-based loading

```typescript
const agentos = await AgentOS.create({
  extensionManifest: {
    packs: [
      {
        package: '@framers/agentos-ext-pii-redaction',
        options: {
          redactionStyle: 'mask',
          enableNerModel: false,
        },
      },
    ],
  },
});
```

### Via the curated registry

```typescript
import { AgentOS } from '@framers/agentos';
import { createCuratedManifest } from '@framers/agentos-extensions-registry';

const manifest = await createCuratedManifest({
  tools: ['pii-redaction'],
  channels: 'none',
});
const agentos = await AgentOS.create({ extensionManifest: manifest });
```

---

## Configuration

`createPiiRedactionGuardrail(options)` takes `PiiRedactionPackOptions`. Every field is optional.

| Option | Default | What it sets |
|---|---|---|
| `entityTypes` | every type (`ALL_PII_ENTITY_TYPES`) | The kinds to detect |
| `confidenceThreshold` | `0.5` | Entities scoring below it are dropped, after the LLM judge |
| `redactionStyle` | `'placeholder'` | How a found span is written (see [Redaction styles](#redaction-styles)) |
| `allowlist` | none | Found text equal to one of these strings, in any case, is left in place |
| `denylist` | none | Found text equal to one of these strings scores 1.0 |
| `enableNerModel` | `true` | Whether tier 3 may load; only `false` turns it off |
| `nerDtype` | `'q8'` | The NER model's weights: `q8` (`onnx/model_quantized.onnx`, 109 MB) or `fp32` (`onnx/model.onnx`, 431 MB) |
| `llmJudge` | none | Turns tier 4 on (see [`LlmJudgeConfig`](#llmjudgeconfig)) |
| `guardrailScope` | `'both'` | `'input'`, `'output'` or `'both'` |
| `evaluateStreamingChunks` | `false` | Whether the guardrail receives streamed text deltas; with `false`, AgentOS hands it the final response only |
| `maxStreamingEvaluations` | `50` | Sentence-boundary scans per stream |
| `failClosed` | `true` | Whether a guardrail evaluation that throws blocks the text |

`allowlist` and `denylist` accept `RegExp` entries in their type; detection applies the string entries alone.

### `LlmJudgeConfig`

| Option | Default | Description |
|---|---|---|
| `provider` | - | Names the secret the key falls back to (`<provider>.apiKey`) |
| `model` | - | Model ID sent in the request |
| `apiKey` | - | API key; without it the guardrail asks the extension manager for the secret `<provider>.apiKey`, then `pii.llm.apiKey` |
| `baseUrl` | `https://api.openai.com/v1` | Base URL of an OpenAI-compatible chat completions endpoint |
| `maxConcurrency` | `4` | Concurrent judge calls |
| `cacheSize` | `256` | LRU cache entries, keyed by the span text and a hash of its context |

The judge sends an OpenAI chat completions request (`POST <baseUrl>/chat/completions`, temperature 0.1) whatever `provider` says. A provider other than OpenAI therefore needs `baseUrl` set to an OpenAI-compatible endpoint; without it, the request and its key go to `api.openai.com`. The `pii_scan` and `pii_redact` tools use `llmJudge.apiKey` only.

---

## Detection Tiers

The pipeline (`PiiDetectionPipeline.detect()`) runs the tiers in order, merges overlapping spans (`EntityMerger`, which also applies the allowlist and denylist), runs the judge, then drops entities under `confidenceThreshold`. The result lists the entities with their positions, scores and sources, `tiersExecuted` (`'regex'`, `'ner'`, `'llm'`) and a summary such as `3 entities found: 1×EMAIL, 1×PERSON, 1×SSN`.

### Tier 1: Regex (always runs)

openredaction's patterns, with its false-positive filter off: that filter drops a phone number when a word beginning "on", "after" or "address" sits within 50 characters of it, and an email address near a link's "//". Each pattern's own validator still runs. Matches score at least 0.85. Keywords within 50 characters raise a score by 0.2 or 0.15 (for example `social security` for an SSN, `date of birth` for a date of birth, `name:` for a person).

### Tier 2: NLP pre-filter

[compromise](https://www.npmjs.com/package/compromise) proposes people, places and organisations at low confidence (0.3 to 0.6). Without `compromise`, the tier returns nothing.

### Tier 3: NER model

`Xenova/bert-base-NER` through transformers.js labels `PERSON`, `LOCATION`, `ORGANIZATION` and, from its MISC label, `UNKNOWN_PII`. It runs only when tier 2 proposed a person, place or organisation and `enableNerModel` is not `false`; without tier 2 candidates, as when `compromise` is missing, it does not run. A model that cannot load (no `@huggingface/transformers`, a failed download) disables the tier.

### Tier 4: LLM judge (only with `llmJudge`)

The judge re-examines each merged entity scoring above 0.3 and below 0.7. When it answers `NOT_PII`, the entity is dropped; otherwise the entity takes the judge's type and confidence (the judge may relabel it, for example as `MEDICAL_TERM`). When the call fails, the entity keeps its original score.

---

## Redaction Styles

| Style | Input | Output | Notes |
|---|---|---|---|
| `placeholder` | `John Smith` | `[PERSON]` | The entity type. Default. |
| `mask` | `John Smith` | `J*** S****` | Each word keeps its first character; the rest is starred. |
| `hash` | `John Smith` | `[PERSON:a1b2c3d4e5]` | The type and the first 10 hex characters of the text's SHA-256. The same text always gives the same hash; not reversible. |
| `category-tag` | `John Smith` | `<PII type="PERSON">REDACTED</PII>` | An XML-style tag. |

---

## The guardrail

The guardrail's config sets `canSanitize: true`, so AgentOS runs it among the sanitising guardrails, `failClosed` from the option (default `true`: when detection throws, the dispatcher blocks the text instead of passing it through unredacted) and `evaluateStreamingChunks` from the option of that name.

- **Input**: the user's text is scanned and returned redacted.
- **Output**: each stream's text is buffered by stream ID. With `evaluateStreamingChunks: true`, the buffer is scanned whenever it holds a sentence boundary (`. `, `? `, `! ` or a newline), up to `maxStreamingEvaluations` times; the final response is always scanned, and its buffer is then dropped.

---

## Agent Tools

### `pii_scan`

Scans text and returns the detection result without changing it. Arguments: `text` and an optional `entityTypes` filter.

```
→ pii_scan({ text: "Contact John Smith at john@mail.invalid, SSN 123-45-6789" })
← {
    entities: [ { entityType, text, start, end, score, source, metadata }, ... ],
    inputLength: 56,
    processingTimeMs: 42,
    tiersExecuted: ["regex", "ner"],
    summary: "3 entities found: 1×EMAIL, 1×PERSON, 1×SSN"
  }
```

### `pii_redact`

Scans text and returns it redacted. Arguments: `text` and an optional `redactionStyle` overriding the pack's.

```
→ pii_redact({
    text: "Email john@acme.invalid about the 4111-1111-1111-1111 charge",
    redactionStyle: "placeholder"
  })
← {
    redactedText: "Email [EMAIL] about the [CREDIT_CARD] charge",
    originalText: "Email john@acme.invalid about the 4111-1111-1111-1111 charge",
    wasRedacted: true,
    detectionResult: { entities: [...], ... }
  }
```

The result carries `originalText` as well, so the model that called the tool sees the unredacted text in it.

---

## Shared services and lazy loading

The NLP library and the NER pipeline load on first use, through the extension manager's shared service registry (`ISharedServiceRegistry`) when AgentOS activates the pack:

| Service ID | Dependency |
|---|---|
| `agentos:nlp:compromise` | `compromise` |
| `agentos:nlp:ner-pipeline` | `@huggingface/transformers` (`Xenova/bert-base-NER`) |

Concurrent `getOrCreate()` calls for one ID share one factory call. The guardrail and both tools share these instances, so the first pack to load the NER pipeline decides its weights for every pack on the registry. The LLM judge uses `fetch` and registers no service.

For memory-constrained environments, set `enableNerModel: false` and leave `llmJudge` unset: detection then runs the regex tier and the NLP pre-filter.

---

## Related Documentation

- [PII Redaction (and PHI scrubbing)](/features/pii-redaction)
- [Guardrails](/features/guardrails)
- [Extension Architecture](/extensions/extension-architecture)
- [Extensions Overview](/extensions)
- [Safety Primitives](/features/safety-primitives)
