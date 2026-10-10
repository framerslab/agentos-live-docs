---
title: "LLM Output Validation"
sidebar_position: 1.5
displayed_sidebar: guideSidebar
---

> Zod validation with retry and error feedback, JSON extraction from messy model output, and reusable schema pieces: helpers a host wraps around its own LLM calls.

---

## Overview

Code that calls an LLM and expects JSON has to pull it out of fenced blocks, reasoning tags and prose, then check its shape. The validation layer in [`src/safety/validation`](https://github.com/framerslab/agentos/tree/master/src/safety/validation) gives a host:

- **`extractJson()`**: finds JSON in markdown fences, after `<thinking>` blocks, in JSONL, or embedded in prose
- **`createValidatedInvoker()`**: wraps an LLM invoker with Zod validation and retry
- **Schema primitives**: reusable Zod pieces for common LLM output fields
- **`LlmOutputValidationError`**: the error thrown after the last retry, with the raw output, the Zod errors and the retry history

Import them from `@framers/agentos/safety/validation` (or as the `validation` namespace of `@framers/agentos/safety`); `extractJson` is also exported from `@framers/agentos`. No AgentOS component calls these helpers. For structured output from the runtime itself, see [Structured output from agents](#structured-output-from-agents).

## `extractJson`: JSON Extraction

Handles the common LLM output formats in one call and returns the JSON text, or `null`:

```typescript
import { extractJson } from '@framers/agentos/safety/validation';

extractJson('{"a": 1}');                                // '{"a": 1}'
extractJson('```json\n{"a": 1}\n```');                  // '{"a": 1}'
extractJson('<thinking>hmm</thinking>\n{"a": 1}');      // '{"a": 1}'
extractJson('Result: {"a": 1} done');                   // '{"a": 1}'
extractJson('{"a":1}\n{"b":2}');                        // '[{"a":1},{"b":2}]' (JSONL)
extractJson('just plain text');                          // null
```

**Extraction strategies (priority order):**
1. Raw JSON: the whole string parses
2. Markdown fenced blocks: ` ```json ... ``` ` or a bare ` ``` ` fence
3. `<thinking>` block stripping: remove the reasoning, then run the strategies again on the rest
4. JSONL: when two or more lines each parse to an object or array, they become one array (other lines are skipped)
5. Brace/bracket matching: the first `{...}` or `[...]` in the text; when that span does not parse, the result is `null`

## `createValidatedInvoker`: Validated LLM Wrapper

Wraps any `(systemPrompt, userPrompt) => Promise<string>` invoker with Zod validation:

```typescript
import { createValidatedInvoker } from '@framers/agentos/safety/validation';
import { z } from 'zod';

const PersonalitySchema = z.object({
  honesty: z.number().min(0).max(100),
  emotionality: z.number().min(0).max(100),
  extraversion: z.number().min(0).max(100),
});

const validated = createValidatedInvoker(llmInvoker, PersonalitySchema, {
  maxRetries: 2,              // retries after the first call (default: 1)
  injectSchemaOnRetry: true,  // name the expected format in the retry prompt (default: true)
});

const personality = await validated(systemPrompt, userPrompt);
// personality is typed as { honesty: number; emotionality: number; extraversion: number }
```

**Pipeline:**
1. Call the LLM through the raw invoker
2. Extract JSON with `extractJson()`
3. Parse with `JSON.parse`
4. Validate with Zod `.safeParse()` (which fills `.default()` values)
5. If valid: return the typed result
6. If not: call again with the error appended to the system prompt
7. If the last retry fails: throw `LlmOutputValidationError`

With `maxRetries: 2` the invoker is called at most three times.

**Retry prompt:** on a retry, the system prompt gets:
- the previous attempt's error: `No JSON found in LLM output`, `JSON parse error: ...`, or `Zod validation: <path>: <message>; ...`
- the instruction `Please output ONLY valid JSON matching the required format.`
- with `injectSchemaOnRetry`, a `Required JSON format:` line naming the fields of an object schema (`A JSON object with these fields: honesty, emotionality, extraversion`), or `A valid JSON object matching the required schema` for any other schema. For a schema without an object shape, `describeSchema()` first tries to load `zod-to-json-schema` with `require()`. The package ships ES modules, where Node defines no `require`, so under Node the call throws, the error is caught, and the fixed sentence is used whether or not `zod-to-json-schema` is installed

The invoker type declares a `supportsStructuredOutput` flag and the options declare `preferStructuredOutput`; the wrapper reads neither, so every invoker gets the same extract, validate and retry loop.

## Structured output from agents

`agent()` accepts a `responseSchema` option in its types but does not read it: `generate()` returns no `parsed` value. For a validated object from an agent, pass the schema on a session send:

```typescript
import { agent } from '@framers/agentos';
import { z } from 'zod';

const extractor = agent({
  provider: 'openai',
  model: 'gpt-4o',
  instructions: 'Extract entities from text as JSON.',
});

const result = await extractor.session().send('Find entities in: The cat sat on the mat.', {
  responseSchema: z.object({
    entities: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
});
// result.object.entities is string[]: Zod-validated and typed
// result.text is the JSON string the model returned
```

`send()` with `responseSchema` sends the schema through the provider's structured-output API where the payload can carry it, and in the system prompt otherwise. A reply that does not parse or fails the schema throws `ObjectGenerationError`; it is not retried. `agency({ output: schema })` validates the final text and puts the value on `result.parsed`, retrying `controls.maxValidationRetries` times (default 1) and returning `parsed: undefined` when every attempt fails. For one-off calls, `generateObject()` validates with retries (see [Structured Output API](/features/structured-output-api)).

## Schema Primitives

Reusable Zod pieces for common fields:

```typescript
import {
  MemoryTypeEnum,        // 'episodic' | 'semantic' | 'procedural' | 'prospective' | 'relational'
  MemoryScopeEnum,       // 'user' | 'thread' | 'persona' | 'organization'
  ConfidenceScore,       // z.number().min(0).max(1)
  EntityArray,           // z.array(z.string()).default([])
  TagArray,              // z.array(z.string()).default([])
  ImportanceScore,       // z.number().min(0).max(1).default(0.5)
  ObservationNoteOutput, // an observer note
  ReflectionTraceOutput, // a reflector trace
  CompressedObservationOutput, // a compressed observation
  ContentFeaturesOutput, // content feature flags
} from '@framers/agentos/safety/validation';
```

Compose domain-specific schemas from the primitives:

```typescript
const MyOutputSchema = z.object({
  type: MemoryTypeEnum,
  confidence: ConfidenceScore,
  entities: EntityArray,
  customField: z.string(),
});
```

## Error Handling

When the last retry fails, the validated invoker throws `LlmOutputValidationError`:

```typescript
import { LlmOutputValidationError } from '@framers/agentos/safety/validation';

try {
  const result = await validatedInvoker(system, user);
} catch (err) {
  if (err instanceof LlmOutputValidationError) {
    console.error('Raw output:', err.rawOutput);     // the last attempt's raw text
    console.error('Zod errors:', err.zodErrors);     // the last attempt's ZodError (empty when it held no JSON)
    console.error('Retry count:', err.retryCount);   // the configured maxRetries
    console.error('History:', err.retryHistory);
    // retryHistory: [{ attempt: 0, rawOutput: '...', error: '...' }, ...]
  }
}
```
