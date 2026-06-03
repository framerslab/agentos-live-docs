---
title: "Provider Preferences"
sidebar_position: 5
displayed_sidebar: guideSidebar
---

The [`ProviderPreferences`](https://github.com/framerslab/agentos/blob/master/src/io/media/ProviderPreferences.ts) system gives callers fine-grained control over which media providers are used and in what order. It applies to image generation, video generation, and audio generation (music and SFX separately).

## Core types

### [`MediaProviderPreference`](https://github.com/framerslab/agentos/blob/master/src/io/media/ProviderPreferences.ts)

Per-modality provider preference configuration:

```typescript
interface MediaProviderPreference {
  /** Ordered list of preferred provider IDs. */
  preferred?: string[];
  /** Weight map for weighted random selection (default weight is 1). */
  weights?: Record<string, number>;
  /** Provider IDs to unconditionally exclude. */
  blocked?: string[];
}
```

### [`ProviderPreferences`](https://github.com/framerslab/agentos/blob/master/src/io/media/ProviderPreferences.ts)

Top-level preferences grouped by media modality:

```typescript
interface ProviderPreferences {
  image?: MediaProviderPreference;
  video?: MediaProviderPreference;
  audio?: {
    music?: MediaProviderPreference;
    sfx?: MediaProviderPreference;
  };
}
```

Audio is split into `music` and `sfx` sub-modalities since music generation and sound-effect generation often use different provider backends.

## Resolution functions

### `resolveProviderOrder(available, preferences)`

Filter and reorder an "available" provider list according to user preferences. Resolution rules (applied in order):

1. If `preferences` is `undefined` or empty, return `available` unchanged.
2. If `preferred` is set, keep only providers in **both** `available` and `preferred`, preserving the `preferred` order.
3. If `blocked` is set, remove any provider whose ID appears in `blocked`.

```typescript
import { resolveProviderOrder } from '@framers/agentos';

resolveProviderOrder(['a', 'b', 'c'], { preferred: ['c', 'a'] });
// => ['c', 'a']

resolveProviderOrder(['a', 'b', 'c'], { blocked: ['b'] });
// => ['a', 'c']
```

### `selectWeightedProvider(providers, weights)`

Pick a single provider from a list using optional per-provider weights. Providers not listed in the `weights` map default to weight `1`.

```typescript
import { selectWeightedProvider } from '@framers/agentos';

// ~90% suno, ~10% udio
selectWeightedProvider(['suno', 'udio'], { suno: 9, udio: 1 });
```

### `resolveProviderChain(available, preferences)`

Combines deterministic filtering/reordering with optional weighted primary selection. When `weights` are present, a single primary provider is chosen via weighted random selection and moved to the front, with the remaining providers as ordered fallbacks.

```typescript
import { resolveProviderChain } from '@framers/agentos';

const available = ['openai', 'stability', 'replicate'];

const chain = resolveProviderChain(available, {
  preferred: ['replicate', 'openai'],
  blocked: ['stability'],
  weights: { replicate: 9, openai: 1 },
});
// => ['replicate', 'openai'] most of the time
```

## Per-call overrides

Every media generation function accepts a `providerPreferences` option for per-call overrides:

### Image generation

```typescript
import { generateImage } from '@framers/agentos';

const result = await generateImage({
  prompt: 'Art deco travel poster for a moon colony',
  providerPreferences: {
    preferred: ['stability', 'replicate'],
    blocked: ['openai'],
  },
});
```

### Video generation

```typescript
import { generateVideo } from '@framers/agentos';

const result = await generateVideo({
  prompt: 'A drone flying over a misty forest at sunrise',
  providerPreferences: {
    preferred: ['runway', 'fal'],
    weights: { runway: 8, fal: 2 },
  },
});
```

### Music generation

```typescript
import { generateMusic } from '@framers/agentos';

const result = await generateMusic({
  prompt: 'Upbeat lo-fi hip hop beat with vinyl crackle',
  providerPreferences: {
    preferred: ['suno', 'udio'],
    blocked: ['musicgen-local'],
  },
});
```

### SFX generation

```typescript
import { generateSFX } from '@framers/agentos';

const result = await generateSFX({
  prompt: 'Glass breaking on a marble floor',
  providerPreferences: {
    preferred: ['elevenlabs-sfx', 'stable-audio'],
    weights: { 'elevenlabs-sfx': 7, 'stable-audio': 3 },
  },
});
```

## Use cases

### Load balancing

Use `weights` to distribute traffic across providers for cost optimisation or rate-limit management:

```typescript
const prefs: MediaProviderPreference = {
  weights: {
    'stability': 6,   // 60% of requests
    'replicate': 3,    // 30% of requests
    'fal': 1,          // 10% of requests
  },
};
```

### A/B testing

Compare output quality by splitting traffic:

```typescript
const prefs: MediaProviderPreference = {
  weights: {
    'runway': 5,     // 50% — test candidate
    'replicate': 5,  // 50% — baseline
  },
};
```

### Cost-constrained environments

Block expensive providers in development:

```typescript
const prefs: MediaProviderPreference = {
  blocked: ['runway', 'suno'],
  preferred: ['musicgen-local', 'audiogen-local'],
};
```

## How the fallback chain works

1. The available providers are detected from environment variables.
2. `resolveProviderOrder()` filters and reorders based on `preferred` and `blocked`.
3. If `weights` are present, `selectWeightedProvider()` picks the primary.
4. The primary provider is initialised; remaining providers become fallbacks.
5. If the primary fails, [`FallbackVideoProxy`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/FallbackVideoProxy.ts) / [`FallbackAudioProxy`](https://github.com/framerslab/agentos/blob/master/src/io/media/audio/FallbackAudioProxy.ts) transparently retries on the next provider in the chain.

This design is stateless and side-effect-free, so it integrates cleanly with any subsystem.
