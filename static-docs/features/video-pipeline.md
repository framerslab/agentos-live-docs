---
sidebar_label: Video Pipeline
sidebar_position: 28
---

# Video Pipeline

AgentOS has three video functions, all exported from `@framers/agentos`:

| Function | Purpose |
|---|---|
| `generateVideo()` | Text-to-video and image-to-video generation through a provider |
| `analyzeVideo()` | Scene segmentation, a description per scene, audio transcription and a summary |
| `detectScenes()` | Scene boundaries from a stream of decoded frames |

## Providers

Video generation runs on three provider adapters, each implementing the [`IVideoGenerator`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/IVideoGenerator.ts) interface:

| Provider | Env Var | Default Model | Capabilities |
|---|---|---|---|
| **Runway** | `RUNWAY_API_KEY` | `gen3a_turbo` | text-to-video, image-to-video |
| **Replicate** | `REPLICATE_API_TOKEN` | `klingai/kling-v1` | text-to-video, image-to-video |
| **Fal** | `FAL_API_KEY` | `kling-video/v1` | text-to-video, image-to-video |

When more than one provider is available, a [`FallbackVideoProxy`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/FallbackVideoProxy.ts) wraps the chain: when a provider call throws, the next provider is tried, and when the last one fails the call throws an `AggregateError`. [Provider Preferences](/features/provider-preferences) covers how the chain is ordered.

## `generateVideo()`

Generate a video from a text prompt or a source image.

```typescript
import { generateVideo } from '@framers/agentos';
import { readFileSync } from 'node:fs';

// Text-to-video
const result = await generateVideo({
  prompt: 'A drone flying over a misty forest at sunrise',
  provider: 'runway',
  durationSec: 5,
  aspectRatio: '16:9',
});
console.log(result.videos[0].url);

// Image-to-video: a source image for motion synthesis
const i2v = await generateVideo({
  prompt: 'Camera slowly zooms out revealing the full landscape',
  image: readFileSync('input.png'),
  provider: 'replicate',
});
```

### [`GenerateVideoOptions`](https://github.com/framerslab/agentos/blob/master/src/api/generateVideo.ts)

| Option | Type | Description |
|---|---|---|
| `prompt` | `string` | Text prompt describing the video (required) |
| `image` | `Buffer` | Source image; switches the call to image-to-video |
| `provider` | `string` | Provider ID (`"runway"`, `"replicate"`, `"fal"`); without it the chain is built from the providers whose keys are set |
| `model` | `string` | Model override (e.g. `"gen3a_turbo"`) |
| `durationSec` | `number` | Desired output duration in seconds |
| `aspectRatio` | [`VideoAspectRatio`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/types.ts) | Output aspect ratio (`"16:9"`, `"9:16"`, `"1:1"`, etc.) |
| `resolution` | `string` | Output resolution (e.g. `"1280x720"`); text-to-video only |
| `negativePrompt` | `string` | Content to avoid |
| `seed` | `number` | Seed for reproducible generation |
| `timeoutMs` | `number` | Maximum wait time in milliseconds |
| `onProgress` | `(event) => void` | Progress callback with [`VideoProgressEvent`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/types.ts) |
| `providerPreferences` | [`MediaProviderPreference`](https://github.com/framerslab/agentos/blob/master/src/io/media/ProviderPreferences.ts) | Reorder or filter the provider chain |
| `apiKey` | `string` | Override the API key |
| `baseUrl` | `string` | Override the provider's base URL |
| `usageLedger` | `AgentOSUsageLedgerOptions` | Where the call's usage is recorded |

`onProgress` receives `queued` (0), `processing` (25), `complete` (100) and, when the call fails, `failed`.

### [`GenerateVideoResult`](https://github.com/framerslab/agentos/blob/master/src/api/generateVideo.ts)

```typescript
interface GenerateVideoResult {
  model: string;     // e.g. "gen3a_turbo"
  provider: string;  // e.g. "runway"
  created: number;   // Unix time in seconds, as the providers set it
  videos: GeneratedVideo[];
  usage?: VideoProviderUsage;
}
```

Each [`GeneratedVideo`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/types.ts) has optional `url`, `base64`, `mimeType`, `durationSec`, `width`, `height`, `thumbnailUrl` and `providerMetadata`.

## `analyzeVideo()`

Analyse a video into scenes, a description of each scene, a transcript and a summary.

```typescript
import { analyzeVideo } from '@framers/agentos';

const analysis = await analyzeVideo({
  videoUrl: 'https://example.com/demo.mp4',
  prompt: 'What products are shown in this video?',
  transcribeAudio: true,
});

console.log(analysis.description);
for (const scene of analysis.scenes ?? []) {
  console.log(`[${scene.startSec}s-${scene.endSec}s] ${scene.description}`);
}
```

The analysis needs `ffmpeg` and `ffprobe` on the `PATH`. It downloads `videoUrl` (or takes `videoBuffer`), extracts frames at one frame per second, detects scene boundaries over them, and asks the vision pipeline to describe the frame nearest each scene's midpoint. With an STT provider it transcribes the audio track and attaches the transcript segments that overlap each scene. A final `generateText()` call on the default provider (temperature 0.3, 500 tokens) writes `description`: the answer to `prompt`, or a two-to-four-sentence summary without one. If that call fails, `description` joins the scene descriptions.

### [`AnalyzeVideoOptions`](https://github.com/framerslab/agentos/blob/master/src/api/analyzeVideo.ts)

| Option | Type | Default | Description |
|---|---|---|---|
| `videoUrl` | `string` | - | URL of the video to analyse |
| `videoBuffer` | `Buffer` | - | Raw video bytes (alternative to URL); one of the two is required |
| `prompt` | `string` | - | Question the summary answers |
| `model` | `string` | auto | Cloud model of the vision pipeline that describes the scenes |
| `maxFrames` | `number` | - | Sample at most this many of the extracted frames, evenly spaced |
| `sceneThreshold` | `number` | `0.3` | Hard-cut threshold; the gradual threshold is half of it |
| `transcribeAudio` | `boolean` | `true` | Transcribe the audio track when an STT provider is found |
| `descriptionDetail` | [`DescriptionDetail`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/types.ts) | `'detailed'` | Recorded in `providerMetadata`; the scene descriptions do not read it |
| `maxScenes` | `number` | `100` | Cap on detected scenes |
| `indexForRAG` | `boolean` | `false` | Return `ragChunkIds` (see below) |
| `onProgress` | `(event) => void` | - | Progress callback with `VideoAnalysisProgressEvent` |
| `usageLedger` | `AgentOSUsageLedgerOptions` | - | Where the call is recorded |

`indexForRAG: true` returns `ragChunkIds`, one generated ID per scene (`video-scene-<n>-<id>`) and one for the summary (`video-summary-<id>`). Nothing is embedded or written to a vector store; a host that wants the analysis in its RAG store indexes `scenes` and `description` itself.

### STT auto-detection

Audio transcription uses the first STT provider whose key is set:
1. OpenAI Whisper (`OPENAI_API_KEY`)
2. Deepgram (`DEEPGRAM_API_KEY`)
3. AssemblyAI (`ASSEMBLYAI_API_KEY`)
4. Azure Speech (`AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`)

With none, the analysis runs without a transcript. A transcription failure is logged and the analysis continues.

## `detectScenes()`

Yields scene boundaries from an async iterable of decoded frames, as `AsyncGenerator<SceneBoundary>`, so a caller handles each scene as it ends without buffering the video.

```typescript
import { detectScenes } from '@framers/agentos';
import type { Frame } from '@framers/agentos/io/vision';

// Frames are raw RGB (3 bytes per pixel), decoded by the caller (ffmpeg, a webcam, ...)
async function* frames(): AsyncGenerator<Frame> {
  // yield { buffer: rgbPixels, timestampSec: 0, index: 0 }; ...
}

for await (const boundary of detectScenes({
  frames: frames(),
  hardCutThreshold: 0.3,
  minSceneDurationSec: 1.0,
})) {
  console.log(
    `Scene ${boundary.index}: ${boundary.startTimeSec}s-${boundary.endTimeSec}s, ended by ${boundary.cutType}`,
  );
}
```

Options: `frames` (required), `methods` (default `['histogram', 'ssim']`), `hardCutThreshold` (default 0.3), `gradualThreshold` (default 0.15), `minSceneDurationSec` (default 1.0) and `clipProvider`.

### Detection methods

| Method | Score |
|---|---|
| `histogram` | Chi-squared distance between the two frames' 768-bin RGB histograms, normalised to [0, 1] |
| `ssim` | Accepted; scores with the histogram distance (no SSIM is computed) |
| `clip` | Accepted; scores with the histogram distance (no CLIP embedding is computed, and `clipProvider` is not read) |

With several methods, the frame-to-frame score is the highest of them.

### Boundaries

A scene ends when the score between two consecutive frames reaches `gradualThreshold` and at least `minSceneDurationSec` has passed since the previous boundary. Each yielded [`SceneBoundary`](https://github.com/framerslab/agentos/blob/master/src/io/vision/types.ts) describes the scene that just ended (`index`, `startFrame`, `endFrame`, `startTimeSec`, `endTimeSec`, `durationSec`, `confidence`, `diffScore`) and the change that ended it in `cutType`:

- `hard-cut`: score at or above `hardCutThreshold`
- `dissolve`: score above 0.25
- `fade`: score above 0.20
- `gradual`: any lower score

After the last frame, the final scene is yielded with confidence 1 and `cutType` `hard-cut` when it is the only scene, else `gradual`. The type also lists `wipe`, which the detector does not produce. `analyzeVideo()` labels its first scene `start`.

## Types reference

### [`VideoAspectRatio`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/types.ts)

```typescript
type VideoAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | (string & {});
```

### [`VideoOutputFormat`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/types.ts)

```typescript
type VideoOutputFormat = 'mp4' | 'webm' | 'gif';
```

### [`VideoProgressEvent`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/types.ts)

```typescript
interface VideoProgressEvent {
  status: 'queued' | 'processing' | 'downloading' | 'complete' | 'failed';
  progress?: number;          // 0-100
  estimatedRemainingMs?: number;
  message?: string;
}
```

### [`VideoAnalysisProgressEvent`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/types.ts)

```typescript
interface VideoAnalysisProgressEvent {
  phase: 'extracting-frames' | 'detecting-scenes' | 'describing'
       | 'transcribing' | 'summarizing';
  progress?: number;
  currentScene?: number;
  message?: string;
}
```

## Observability

`generateVideo()` and `analyzeVideo()` run inside OpenTelemetry spans (`agentos.api.generate_video`, `agentos.api.analyze_video`) when tracing is on, and record the call in the usage ledger when one is configured: `generateVideo()` with its provider, model, video count and cost, `analyzeVideo()` with no usage figures. `detectScenes()` records nothing.
