---
sidebar_label: Audio Generation
sidebar_position: 29
---

# Audio Generation

AgentOS provides provider-agnostic APIs for generating music and sound effects from text prompts. Two high-level functions cover the full audio generation pipeline:

| Function | Purpose |
|---|---|
| `generateMusic()` | Full-length musical compositions from text prompts |
| `generateSFX()` | Short sound effects from text descriptions |

Both APIs support automatic provider detection, fallback chains via [`FallbackAudioProxy`](https://github.com/framerslab/agentos/blob/master/src/io/media/audio/FallbackAudioProxy.ts), progress callbacks, and per-call provider preference overrides.

## Providers

### Music providers

| Provider | Env Var | ID | Notes |
|---|---|---|---|
| **Suno** | `SUNO_API_KEY` | `suno` | Up to ~240s, highest quality |
| **Udio** | `UDIO_API_KEY` | `udio` | Cloud music generation |
| **Stable Audio** | `STABILITY_API_KEY` | `stable-audio` | Up to ~47s |
| **Replicate** | `REPLICATE_API_TOKEN` | `replicate-audio` | Various music models |
| **Fal** | `FAL_API_KEY` | `fal-audio` | Various music models |
| **MusicGen Local** | (none) | `musicgen-local` | Local via HuggingFace Transformers.js |

### SFX providers

| Provider | Env Var | ID | Notes |
|---|---|---|---|
| **ElevenLabs** | `ELEVENLABS_API_KEY` | `elevenlabs-sfx` | Highest quality SFX |
| **Stable Audio** | `STABILITY_API_KEY` | `stable-audio` | Also supports SFX |
| **Replicate** | `REPLICATE_API_TOKEN` | `replicate-audio` | Various SFX models |
| **Fal** | `FAL_API_KEY` | `fal-audio` | Various SFX models |
| **AudioGen Local** | (none) | `audiogen-local` | Local via HuggingFace Transformers.js |

Provider resolution follows priority order (top of table = highest priority). When multiple providers are configured, a [`FallbackAudioProxy`](https://github.com/framerslab/agentos/blob/master/src/io/media/audio/FallbackAudioProxy.ts) wraps the chain for automatic failover.

## `generateMusic()`

Generate a musical composition from a text prompt.

```typescript
import { generateMusic } from '@framers/agentos';

const result = await generateMusic({
  prompt: 'Upbeat lo-fi hip hop beat with vinyl crackle and mellow piano',
  durationSec: 60,
});
console.log(result.audio[0].url);
console.log(`Provider: ${result.provider}, Model: ${result.model}`);
```

### With provider preferences

```typescript
const result = await generateMusic({
  prompt: 'Ambient electronic soundscape with reverb pads',
  provider: 'stable-audio',
  model: 'stable-audio-open-1.0',
  durationSec: 30,
  outputFormat: 'wav',
  onProgress: (event) => {
    console.log(`[${event.status}] ${event.progress ?? '?'}% - ${event.message}`);
  },
});
```

### [`GenerateMusicOptions`](https://github.com/framerslab/agentos/blob/master/src/api/generateMusic.ts)

| Option | Type | Description |
|---|---|---|
| `prompt` | `string` | Text prompt describing the desired composition (required) |
| `provider` | `string` | Provider ID (`"suno"`, `"udio"`, `"stable-audio"`, etc.) |
| `model` | `string` | Model override within the provider |
| `durationSec` | `number` | Desired output duration in seconds |
| `negativePrompt` | `string` | Musical elements to avoid |
| `outputFormat` | [`AudioOutputFormat`](https://github.com/framerslab/agentos/blob/master/src/io/media/audio/types.ts) | `"mp3"` / `"wav"` / `"flac"` / `"ogg"` / `"aac"` |
| `seed` | `number` | Seed for reproducible generation |
| `timeoutMs` | `number` | Maximum wait time in milliseconds |
| `n` | `number` | Number of clips to generate (default: 1) |
| `onProgress` | `(event) => void` | Progress callback with [`AudioProgressEvent`](https://github.com/framerslab/agentos/blob/master/src/io/media/audio/types.ts) |
| `providerPreferences` | [`MediaProviderPreference`](https://github.com/framerslab/agentos/blob/master/src/io/media/ProviderPreferences.ts) | Reorder or filter the fallback chain |
| `apiKey` | `string` | Override the API key |

## `generateSFX()`

Generate a short sound effect from a text description.

```typescript
import { generateSFX } from '@framers/agentos';

const result = await generateSFX({
  prompt: 'Thunder crack followed by heavy rain on a tin roof',
  durationSec: 5,
});
console.log(result.audio[0].url);
```

### [`GenerateSFXOptions`](https://github.com/framerslab/agentos/blob/master/src/api/generateSFX.ts)

| Option | Type | Description |
|---|---|---|
| `prompt` | `string` | Text prompt describing the desired sound effect (required) |
| `provider` | `string` | Provider ID (`"elevenlabs-sfx"`, `"stable-audio"`, etc.) |
| `model` | `string` | Model override within the provider |
| `durationSec` | `number` | Desired output duration (SFX: typically 1-15s) |
| `outputFormat` | [`AudioOutputFormat`](https://github.com/framerslab/agentos/blob/master/src/io/media/audio/types.ts) | `"mp3"` / `"wav"` / `"flac"` / `"ogg"` / `"aac"` |
| `seed` | `number` | Seed for reproducible generation |
| `timeoutMs` | `number` | Maximum wait time in milliseconds |
| `n` | `number` | Number of clips to generate (default: 1) |
| `onProgress` | `(event) => void` | Progress callback with [`AudioProgressEvent`](https://github.com/framerslab/agentos/blob/master/src/io/media/audio/types.ts) |
| `providerPreferences` | [`MediaProviderPreference`](https://github.com/framerslab/agentos/blob/master/src/io/media/ProviderPreferences.ts) | Reorder or filter the fallback chain |
| `apiKey` | `string` | Override the API key |

## Result types

Both `generateMusic()` and `generateSFX()` return a similar result envelope:

```typescript
interface GenerateMusicResult {
  model: string;     // e.g. "suno-v3.5"
  provider: string;  // e.g. "suno"
  created: number;   // Unix timestamp (seconds)
  audio: GeneratedAudio[];
  usage?: AudioProviderUsage;
}
```

Each [`GeneratedAudio`](https://github.com/framerslab/agentos/blob/master/src/io/media/audio/types.ts) object contains:

```typescript
interface GeneratedAudio {
  url?: string;         // Public download URL
  base64?: string;      // Base64-encoded audio data
  mimeType?: string;    // e.g. "audio/mpeg"
  durationSec?: number; // Clip duration
  sampleRate?: number;  // e.g. 44100
}
```

## [`AudioProgressEvent`](https://github.com/framerslab/agentos/blob/master/src/io/media/audio/types.ts)

```typescript
interface AudioProgressEvent {
  status: 'queued' | 'processing' | 'downloading' | 'complete' | 'failed';
  progress?: number;            // 0-100
  estimatedRemainingMs?: number;
  message?: string;
}
```

Synchronous providers (Stable Audio, ElevenLabs) may jump directly from `processing` to `complete`.

## Local generation

Both `musicgen-local` and `audiogen-local` providers run entirely on the local machine via HuggingFace Transformers.js. No API key is required. They serve as the lowest-priority fallback in the provider chain, ensuring audio generation is always available even without cloud credentials.

## Observability

All audio API calls emit OpenTelemetry spans (`agentos.api.generate_music`, `agentos.api.generate_sfx`) and record usage metrics to the durable usage ledger when configured.
