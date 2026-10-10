---
sidebar_label: Provider Preferences
sidebar_position: 30
---

# Provider Preferences

The [`ProviderPreferences`](https://github.com/framerslab/agentos/blob/master/src/io/media/ProviderPreferences.ts) helpers let a caller choose which media providers a call may use and in what order. `generateImage()`, `generateVideo()`, `generateMusic()` and `generateSFX()` take one `MediaProviderPreference` per call as `providerPreferences`.

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

Audio is split into `music` and `sfx` because the two use different provider lists. No AgentOS function reads the grouped type: a host keeps one and passes `preferences.image`, `preferences.video`, `preferences.audio?.music` or `preferences.audio?.sfx` to the matching call.

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

Pick a single provider from a list using optional per-provider weights. Providers not listed in the `weights` map default to weight `1`, and a weight of `0` excludes a provider. Without weights, or with one provider, it returns the first provider and checks no weight. With two or more providers and a weight map, it throws on a negative or non-finite weight of a listed provider and when every listed provider's weight is `0`. An empty list always throws.

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

`generateImage()`, `generateVideo()`, `generateMusic()` and `generateSFX()` accept a `providerPreferences` option. How far it reaches depends on what else the call names:

- **No provider named** (for `generateImage()`, no `provider` and no `model`; for the others, no `provider` and no `apiKey`): the detected providers go through `resolveProviderChain()`, so `preferred`, `blocked` and `weights` all apply. When nothing is left, the call throws its "No ... provider configured" error.
- **A provider named** (or, for video, music and SFX, an `apiKey` without a provider, which picks the first detected provider): that provider runs first whatever the preferences say, `preferred` and `blocked` filter and order only its fallbacks, and `weights` are not read.
- **Images on the `mature` or `private-adult` policy tier** with no `provider` or `model`: the policy router's pick replaces the first provider; the preferences still shape the fallbacks.

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

For a call that names no provider:

1. The available providers are those whose environment variable is set and whose factory is registered, in a fixed order per modality. Music and SFX also list their local providers (`musicgen-local`, `audiogen-local`), which need no key. For images, a default set with `setDefaultProvider()` leads the list.
2. `resolveProviderOrder()` filters and reorders the list with `preferred` and `blocked`.
3. If `weights` are present, `selectWeightedProvider()` picks the primary and moves it to the front.
4. The primary provider is initialised, then each fallback; a fallback that fails to initialise (missing credentials, for example) is left out.
5. When a provider call throws, [`FallbackImageProxy`](https://github.com/framerslab/agentos/blob/master/src/io/media/images/FallbackImageProxy.ts), [`FallbackVideoProxy`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/FallbackVideoProxy.ts) or [`FallbackAudioProxy`](https://github.com/framerslab/agentos/blob/master/src/io/media/audio/FallbackAudioProxy.ts) emits a fallback event and tries the next provider; when the last one fails, it throws an `AggregateError` with every error.

The three resolution helpers keep no state; `selectWeightedProvider()` draws from `Math.random()`.
