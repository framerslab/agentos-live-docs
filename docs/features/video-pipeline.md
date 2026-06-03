---
title: "Video Pipeline"
sidebar_position: 6
displayed_sidebar: guideSidebar
---

AgentOS provides a provider-agnostic video pipeline covering generation (text-to-video, image-to-video), analysis (scene detection, transcription, summarisation), and RAG-ready indexing. Three high-level API functions expose the full pipeline:

| Function | Purpose |
|---|---|
| `generateVideo()` | Text-to-video and image-to-video generation |
| `analyzeVideo()` | Scene detection, description, audio transcription, summarisation |
| `detectScenes()` | Streaming scene boundary detection from a frame source |

## Providers

Video generation is backed by three provider adapters, each implementing the [`IVideoGenerator`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/IVideoGenerator.ts) interface:

| Provider | Env Var | Default Model | Capabilities |
|---|---|---|---|
| **Runway** | `RUNWAY_API_KEY` | `gen-3-alpha` | text-to-video, image-to-video |
| **Replicate** | `REPLICATE_API_TOKEN` | `klingai/kling-v1` | text-to-video, image-to-video |
| **Fal** | `FAL_API_KEY` | varies | text-to-video |

When multiple providers are configured, a [`FallbackVideoProxy`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/FallbackVideoProxy.ts) wraps the chain so that a transient failure on the primary provider automatically retries on the next available backend.

## `generateVideo()`

Generate a video from a text prompt or a source image.

```typescript
import { generateVideo } from '@framers/agentos';

// Text-to-video
const result = await generateVideo({
  prompt: 'A drone flying over a misty forest at sunrise',
  provider: 'runway',
  durationSec: 5,
  aspectRatio: '16:9',
});
console.log(result.videos[0].url);

// Image-to-video — provide a source image for motion synthesis
import { readFileSync } from 'node:fs';

const i2v = await generateVideo({
  prompt: 'Camera slowly zooms out revealing the full landscape',
  image: readFileSync('input.png'),
  provider: 'replicate',
});
```

### [`GenerateVideoOptions`](https://github.com/framerslab/agentos/blob/master/src/api/generateVideo.ts)

| Option | Type | Description |
|---|---|---|
| `prompt` | `string` | Text prompt describing the desired video content (required) |
| `image` | `Buffer` | Source image for image-to-video generation |
| `provider` | `string` | Provider ID (`"runway"`, `"replicate"`, `"fal"`) |
| `model` | `string` | Model override (e.g. `"gen3a_turbo"`) |
| `durationSec` | `number` | Desired output duration in seconds |
| `aspectRatio` | [`VideoAspectRatio`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/types.ts) | Output aspect ratio (`"16:9"`, `"9:16"`, `"1:1"`, etc.) |
| `resolution` | `string` | Output resolution (e.g. `"1280x720"`) |
| `negativePrompt` | `string` | Content to avoid |
| `seed` | `number` | Seed for reproducible generation |
| `timeoutMs` | `number` | Maximum wait time in milliseconds |
| `onProgress` | `(event) => void` | Progress callback with [`VideoProgressEvent`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/types.ts) |
| `providerPreferences` | [`MediaProviderPreference`](https://github.com/framerslab/agentos/blob/master/src/io/media/ProviderPreferences.ts) | Reorder or filter the fallback chain |
| `apiKey` | `string` | Override the API key |

### [`GenerateVideoResult`](https://github.com/framerslab/agentos/blob/master/src/api/generateVideo.ts)

```typescript
interface GenerateVideoResult {
  model: string;     // e.g. "gen-3-alpha"
  provider: string;  // e.g. "runway"
  created: number;   // Unix timestamp (ms)
  videos: GeneratedVideo[];
  usage?: VideoProviderUsage;
}
```

Each [`GeneratedVideo`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/types.ts) contains `url`, optional `base64`, `mimeType`, `durationSec`, `width`, `height`, and `thumbnailUrl`.

## `analyzeVideo()`

Analyse a video and produce structured understanding: scene segmentation, per-scene descriptions, audio transcription, and an overall summary.

```typescript
import { analyzeVideo } from '@framers/agentos';

const analysis = await analyzeVideo({
  videoUrl: 'https://example.com/demo.mp4',
  prompt: 'What products are shown in this video?',
  transcribeAudio: true,
  descriptionDetail: 'detailed',
  indexForRAG: true,
});

console.log(analysis.description);
for (const scene of analysis.scenes ?? []) {
  console.log(`[${scene.startSec}s-${scene.endSec}s] ${scene.description}`);
}
// RAG chunk IDs are available for retrieval
console.log(analysis.ragChunkIds);
```

### [`AnalyzeVideoOptions`](https://github.com/framerslab/agentos/blob/master/src/api/analyzeVideo.ts)

| Option | Type | Default | Description |
|---|---|---|---|
| `videoUrl` | `string` | - | URL of the video to analyse |
| `videoBuffer` | `Buffer` | - | Raw video bytes (alternative to URL) |
| `prompt` | `string` | - | Analysis question / guidance |
| `model` | `string` | auto | Vision LLM model identifier |
| `maxFrames` | `number` | - | Maximum frames to sample |
| `sceneThreshold` | `number` | `0.3` | Scene change sensitivity (0-1) |
| `transcribeAudio` | `boolean` | `true` | Transcribe audio track via STT |
| `descriptionDetail` | [`DescriptionDetail`](https://github.com/framerslab/agentos/blob/master/src/io/media/video/types.ts) | `'detailed'` | `'brief'` / `'detailed'` / `'exhaustive'` |
| `maxScenes` | `number` | `100` | Cap on detected scenes |
| `indexForRAG` | `boolean` | `false` | Index results into the RAG vector store |
| `onProgress` | `(event) => void` | - | Progress callback |

When `indexForRAG: true`, scene descriptions and transcripts are chunked and embedded into the configured vector store. The returned `ragChunkIds` can be used for downstream retrieval.

### STT auto-detection

Audio transcription probes for STT providers in priority order:
1. OpenAI Whisper (`OPENAI_API_KEY`)
2. Deepgram (`DEEPGRAM_API_KEY`)
3. AssemblyAI (`ASSEMBLYAI_API_KEY`)
4. Azure Speech (`AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`)

## `detectScenes()`

Stream scene boundaries from a frame source. Returns an `AsyncGenerator<SceneBoundary>` so callers can process boundaries as they are detected without buffering the entire video.

```typescript
import { detectScenes } from '@framers/agentos';

// Pre-recorded video (frames from ffmpeg or similar)
for await (const boundary of detectScenes({
  frames: extractFrames('video.mp4'),
  hardCutThreshold: 0.3,
  minSceneDurationSec: 1.0,
})) {
  console.log(`Scene ${boundary.index} at ${boundary.startTimeSec}s (${boundary.cutType})`);
}

// Live webcam with CLIP-based semantic detection
for await (const boundary of detectScenes({
  frames: webcamFrameStream,
  methods: ['histogram', 'ssim', 'clip'],
  clipProvider: 'openai',
})) {
  console.log(`Motion detected at ${boundary.startTimeSec}s`);
}
```

### Detection methods

| Method | Description |
|---|---|
| `histogram` | Chi-squared histogram distance (fast, good for hard cuts) |
| `ssim` | Structural similarity index (catches gradual transitions) |
| `clip` | CLIP embedding cosine distance (semantic scene changes) |

Multiple methods are combined by taking the maximum diff score across all methods.

### Scene boundary types

Each [`SceneBoundary`](https://github.com/framerslab/agentos/blob/master/src/io/vision/types.ts) includes a `cutType` classification:

- `hard-cut` -- Abrupt frame-to-frame change
- `dissolve` -- Cross-dissolve / superimposition
- `fade` -- Fade from/to black or white
- `wipe` -- Directional wipe transition
- `gradual` -- Other gradual transition
- `start` -- First scene in the video

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

All video API calls emit OpenTelemetry spans (`agentos.api.generate_video`, `agentos.api.analyze_video`) and record usage metrics to the durable usage ledger when configured.
