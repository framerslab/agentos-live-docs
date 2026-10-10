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
| **Suno** | `SUNO_API_KEY` | `suno` | Replicate predictions API, model `suno-ai/suno` (the key is a Replicate token) |
| **Udio** | `UDIO_API_KEY` | `udio` | Replicate predictions API, model `udio/udio` |
| **Stable Audio** | `STABILITY_API_KEY` | `stable-audio` | Stability AI `v2beta` API, model `stable-audio-open-1.0`; one synchronous request |
| **Replicate** | `REPLICATE_API_TOKEN` | `replicate-audio` | `meta/musicgen` by default |
| **Fal** | `FAL_API_KEY` | `fal-audio` | Queue API, `fal-ai/stable-audio` by default |
| **MusicGen Local** | (none) | `musicgen-local` | `Xenova/musicgen-small` through `@huggingface/transformers` |

### SFX providers

| Provider | Env Var | ID | Notes |
|---|---|---|---|
| **ElevenLabs** | `ELEVENLABS_API_KEY` | `elevenlabs-sfx` | ElevenLabs Sound Generation API |
| **Stable Audio** | `STABILITY_API_KEY` | `stable-audio` | Same model as for music |
| **Replicate** | `REPLICATE_API_TOKEN` | `replicate-audio` | `meta/audiogen` by default |
| **Fal** | `FAL_API_KEY` | `fal-audio` | `fal-ai/stable-audio` by default |
| **AudioGen Local** | (none) | `audiogen-local` | Defaults to `Xenova/audiogen-medium`, which Hugging Face does not serve (see [Local generation](#local-generation)) |

Provider resolution follows priority order (top of table = highest priority). A cloud provider joins the chain when its environment variable is set; the local provider needs none and always comes last. A named `provider` goes first, followed by the other configured providers. When the chain holds more than one provider, a [`FallbackAudioProxy`](https://github.com/framerslab/agentos/blob/master/src/io/media/audio/FallbackAudioProxy.ts) wraps the chain for automatic failover.

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
| `n` | `number` | Number of clips to request |
| `onProgress` | `(event) => void` | Progress callback with [`AudioProgressEvent`](https://github.com/framerslab/agentos/blob/master/src/io/media/audio/types.ts) |
| `providerPreferences` | [`MediaProviderPreference`](https://github.com/framerslab/agentos/blob/master/src/io/media/ProviderPreferences.ts) | Reorder or filter the fallback chain |
| `apiKey` | `string` | Override the API key of the first provider |
| `providerOptions` | `Record<string, unknown>` | Provider-specific options passed through |

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
| `n` | `number` | Number of clips to request |
| `onProgress` | `(event) => void` | Progress callback with [`AudioProgressEvent`](https://github.com/framerslab/agentos/blob/master/src/io/media/audio/types.ts) |
| `providerPreferences` | [`MediaProviderPreference`](https://github.com/framerslab/agentos/blob/master/src/io/media/ProviderPreferences.ts) | Reorder or filter the fallback chain |
| `apiKey` | `string` | Override the API key of the first provider |
| `providerOptions` | `Record<string, unknown>` | Provider-specific options passed through |

## Result types

Both `generateMusic()` and `generateSFX()` return a similar result envelope:

```typescript
interface GenerateMusicResult {
  model: string;     // e.g. "suno-ai/suno"
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

`generateMusic()` and `generateSFX()` report `queued` (0), `processing` (25), then `complete` (100) or `failed`; the providers report no progress of their own.

## Local generation

Both `musicgen-local` and `audiogen-local` run on the local machine through `@huggingface/transformers`, which must be installed, and download their model on first use. No API key is required. They come last in the auto-detected chain, and with no cloud key set they are the whole chain. `musicgen-local` loads `Xenova/musicgen-small`. `audiogen-local` defaults to `Xenova/audiogen-medium`, a repository Hugging Face does not serve (Xenova publishes no AudioGen export), so local SFX generation fails unless a provider with a key comes earlier in the chain.

## Observability

All audio API calls emit OpenTelemetry spans (`agentos.api.generate_music`, `agentos.api.generate_sfx`) and record usage metrics to the durable usage ledger when configured.
