import React, { useState } from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import DiagramImg from '@site/src/components/DiagramImg';

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className="hero-agentos">
      <div className="hero-agentos__logo">
        <img src="/img/logo.svg" alt="AgentOS" width={72} height={72} />
      </div>

      <h1 className="hero-agentos__title">
        Agent
        <span
          style={{
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6, #EC4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          OS
        </span>
      </h1>

      <p className="hero-agentos__subtitle">{siteConfig.tagline}</p>

      <div className="hero-badges">
        <a href="https://github.com/framerslab/agentos" className="hero-badge" target="_blank" rel="noopener noreferrer">
          {/* Static badge with the star count baked in at build time —
              avoids shields.io's unauthenticated rate-limit fallback
              that intermittently rendered "invalid" on this badge.
              The count comes from a GH_PAT-authenticated API call in
              docusaurus.config.ts and refreshes every deploy. */}
          <img
            src={`https://img.shields.io/badge/stars-${(siteConfig.customFields?.githubStars as number | undefined) ?? 268}-6366f1?style=for-the-badge&logo=github&logoColor=white&labelColor=4f46e5`}
            alt={`GitHub stars: ${(siteConfig.customFields?.githubStars as number | undefined) ?? 268}`}
          />
        </a>
        <a href="https://www.npmjs.com/package/@framers/agentos" className="hero-badge" target="_blank" rel="noopener noreferrer">
          <img src="https://img.shields.io/npm/v/@framers/agentos?style=for-the-badge&logo=npm&logoColor=white&label=npm&color=6366f1&labelColor=4f46e5" alt="npm version" />
        </a>
        <span className="hero-badge">
          <img src="https://img.shields.io/badge/TypeScript-5.4+-6366f1?style=for-the-badge&logo=typescript&logoColor=white&labelColor=4f46e5" alt="TypeScript" />
        </span>
        <span className="hero-badge">
          <img src="https://img.shields.io/badge/license-Apache_2.0-6366f1?style=for-the-badge&labelColor=4f46e5" alt="License" />
        </span>
      </div>

      <div className="hero-buttons">
        <Link className="btn-primary" to="/getting-started">
          Get Started
        </Link>
        <Link className="btn-secondary" to="/getting-started/examples">
          Examples
        </Link>
        <Link className="btn-secondary" to="/api/">
          API Reference
        </Link>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Discord CTA                                                        */
/* ------------------------------------------------------------------ */

/**
 * Two side-by-side CTA cards under the hero: Discord (real-time community)
 * and Contact (the agentos.sh contact page for written inquiries). Both
 * mirror the cards rendered on agentos.sh; kept inline here to avoid a
 * components/ tree just for static link cards.
 */
const ctaCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '1rem 1.25rem',
  borderRadius: '12px',
  border: '1px solid var(--ifm-color-emphasis-300)',
  background: 'var(--ifm-background-surface-color)',
  textDecoration: 'none',
  color: 'inherit',
  transition: 'border-color 0.2s, background 0.2s, transform 0.2s',
  flex: '1 1 320px',
};

function liftCard(e: React.MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.style.borderColor = 'var(--ifm-color-primary)';
  e.currentTarget.style.transform = 'translateY(-1px)';
}

function dropCard(e: React.MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.style.borderColor = 'var(--ifm-color-emphasis-300)';
  e.currentTarget.style.transform = 'translateY(0)';
}

function ContactCTAs() {
  return (
    <section
      style={{
        padding: '1rem 2rem 0',
        maxWidth: '960px',
        margin: '0 auto',
      }}
      aria-label="Talk to the AgentOS team — Discord or contact form"
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <a
          href="https://wilds.ai/discord"
          target="_blank"
          rel="noopener noreferrer"
          style={ctaCardStyle}
          onMouseEnter={liftCard}
          onMouseLeave={dropCard}
        >
          <img
            src="/img/wilds-ai-icon.png"
            alt="Wilds AI"
            width={48}
            height={48}
            loading="lazy"
            decoding="async"
            style={{ borderRadius: '8px', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>
              Join the Wilds AI Discord
            </div>
            <div
              style={{
                fontSize: '0.85rem',
                opacity: 0.75,
                marginTop: '0.15rem',
              }}
            >
              Real-time community for AgentOS and Paracosm support and developer onboarding.
            </div>
          </div>
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0,
              fontWeight: 600,
              color: 'var(--ifm-color-primary)',
              fontSize: '0.9rem',
            }}
          >
            Join &rarr;
          </span>
        </a>

        <a
          href="https://agentos.sh/en/contact"
          target="_blank"
          rel="noopener noreferrer"
          style={ctaCardStyle}
          onMouseEnter={liftCard}
          onMouseLeave={dropCard}
        >
          <div
            aria-hidden="true"
            style={{
              flexShrink: 0,
              width: 48,
              height: 48,
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              color: '#fff',
              fontSize: '1.5rem',
            }}
          >
            ✉
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>
              Contact the AgentOS team
            </div>
            <div
              style={{
                fontSize: '0.85rem',
                opacity: 0.75,
                marginTop: '0.15rem',
              }}
            >
              Partnerships, investment, press, security, hiring — written inquiries to team@frame.dev.
            </div>
          </div>
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0,
              fontWeight: 600,
              color: 'var(--ifm-color-primary)',
              fontSize: '0.9rem',
            }}
          >
            Contact &rarr;
          </span>
        </a>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Forge Demo (animated webp, png fallback)                          */
/* ------------------------------------------------------------------ */

/**
 * Animated demo of runtime agent spawning. Mirrors the ForgeDemoSection on
 * agentos.sh. Server-rendered, zero client JS: the only dynamic element
 * is the animated WebP/PNG, both lazy-loaded so neither blocks first paint.
 *
 * Asset trail:
 *  - WebP (~1.9 MB animated, lossless from the source GIF). Modern browsers.
 *  - PNG fallback (~660 KB static frame). Same scenario, climactic frame.
 */
function ForgeDemoSection() {
  return (
    <section style={{ padding: '2rem 2rem 1rem', maxWidth: '1100px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <p
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ifm-color-primary)',
            marginBottom: '0.5rem',
          }}
        >
          Runtime agent spawning
        </p>
        <h2 style={{ fontSize: '1.65rem', margin: '0 0 0.5rem' }}>
          Watch an agent spawn a specialist at runtime
        </h2>
        <p style={{ fontSize: '0.95rem', opacity: 0.75, maxWidth: '720px', margin: '0 auto' }}>
          A manager with a researcher and a writer gets a task neither of them covers. It calls
          <code>spawn_specialist</code>, the LLM judge approves the new agent&apos;s spec, and the
          specialist joins the roster as a <code>delegate_to_&lt;role&gt;</code> tool for the
          manager&apos;s next turn.
        </p>
      </header>
      <figure
        style={{
          margin: 0,
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid var(--ifm-color-emphasis-300)',
          boxShadow: '0 20px 40px rgba(99, 102, 241, 0.1)',
        }}
      >
        {/* Was a 1.93 MB lossless animated WebP. Re-encoded to a 742 KB H.264
            MP4 (visually identical at this size) and served as an autoplaying,
            looping, muted, inline <video>. preload="none" keeps it from
            loading until it scrolls into view, so it no longer competes for
            bandwidth during initial page load. Same 1600x920 box, same styles;
            the static PNG is the poster + the <img> fallback for any browser
            without <video>/H.264. */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          poster="/img/demos/agentos-emergent-demo.png"
          width={1600}
          height={920}
          aria-label="An AgentOS manager with a researcher and a writer spawns a security_audit_specialist agent at runtime; the LLM judge approves its spec and the specialist joins the roster."
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <source src="/img/demos/agentos-forge-demo.mp4" type="video/mp4" />
          <img
            src="/img/demos/agentos-emergent-demo.png"
            alt="An AgentOS manager with a researcher and a writer spawns a security_audit_specialist agent at runtime; the LLM judge approves its spec and the specialist joins the roster."
            width={1600}
            height={920}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </video>
        <figcaption
          style={{
            padding: '0.65rem 1rem',
            fontSize: '0.8rem',
            opacity: 0.75,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            background: 'var(--ifm-background-surface-color)',
          }}
        >
          <span>
            Captured from a run of <code>node examples/emergent-hierarchical-spawning.mjs</code> with a security-audit prompt
          </span>
          <a
            href="https://github.com/framerslab/agentos/blob/master/examples/emergent-hierarchical-spawning.mjs"
            target="_blank"
            rel="noopener noreferrer"
          >
            View source on GitHub &rarr;
          </a>
        </figcaption>
      </figure>
      <p style={{ textAlign: 'center', marginTop: '0.75rem' }}>
        <Link to="/features/emergent-capabilities" style={{ fontSize: '0.9rem' }}>
          How emergent capabilities work &rarr;
        </Link>
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Install Tabs                                                       */
/* ------------------------------------------------------------------ */

const installCommands = {
  npm: 'npm install @framers/agentos',
  pnpm: 'pnpm add @framers/agentos',
  yarn: 'yarn add @framers/agentos',
  bun: 'bun add @framers/agentos',
};

function InstallTabs() {
  const [pm, setPm] = useState<keyof typeof installCommands>('npm');
  return (
    <section style={{ padding: '2rem 2rem 0', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
        {(Object.keys(installCommands) as Array<keyof typeof installCommands>).map((key) => (
          <button
            key={key}
            onClick={() => setPm(key)}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '6px 6px 0 0',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.8rem',
              fontWeight: pm === key ? 700 : 400,
              background: pm === key ? 'var(--ifm-color-primary)' : 'transparent',
              color: pm === key ? '#fff' : 'var(--ifm-font-color-base)',
              opacity: pm === key ? 1 : 0.6,
            }}
          >
            {key}
          </button>
        ))}
      </div>
      <CodeBlock language="bash">{installCommands[pm]}</CodeBlock>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick Start Code Tabs                                              */
/* ------------------------------------------------------------------ */

const quickStartCode = {
  'HEXACO Agent': `import { agent } from '@framers/agentos';

// Personality is six 0-1 trait values. Each trait above 0.65 or below 0.35
// adds one line of direction to the system prompt; a trait in between, or
// one left out (0.5), adds none.
const tutor = agent({
  provider: 'openai',
  model: 'gpt-4o',
  instructions: 'You are a patient programming tutor.',
  personality: {
    honesty:           0.85,  // direct, transparent, no flattery
    emotionality:      0.70,  // tone-aware without being clinical
    extraversion:      0.50,  // in between: adds no line
    agreeableness:     0.75,  // warm, encouraging
    conscientiousness: 0.90,  // structured, thorough, follow-through
    openness:          0.85,  // creative, exploratory framing
  },
});

// Each session keeps its own conversation history in process memory
// (bounded to about 120,000 tokens), so two session ids share nothing.
const session = tutor.session('user-42');

// Every send() passes the session's earlier turns to the model.
await session.send('My exam is on distributed systems next Thursday.');
await session.send('I struggle with consensus algorithms.');
const reply = await session.send('What should I focus on this week?');
console.log(reply.text);

// The transcript the session holds, and the tokens it has used.
console.log(session.messages());
const usage = await session.usage();
console.log(\`Total tokens: \${usage.totalTokens}\`);`,

  'Agency': `import { agency } from '@framers/agentos';

// Agency composes a team of GMI brains. Each agent in the roster has its
// own cognition, memory, persona, tools. The agency layer adds an
// orchestration strategy that routes outputs between brains, HITL approval
// gates on every member's tool calls, run limits (controls) and structured
// output. It accepts memory, rag and guardrails options without applying them.
const team = agency({
  provider: 'openai',
  model: 'gpt-4o',
  strategy: 'graph',                        // sequential | parallel | debate | review-loop | hierarchical | graph
  agents: {
    researcher: {
      instructions: 'Find authoritative sources on the topic.',
    },
    writer: {
      instructions: 'Write polished prose from the research.',
      dependsOn: ['researcher'],            // runs after researcher
    },
    reviewer: {
      instructions: 'Check accuracy and tone.',
      dependsOn: ['writer'],
    },
  },
});

// Same .generate() interface as a single agent.
const { text, agentCalls } = await team.generate(
  'Write a briefing on QUIC vs TCP for game networking.'
);
console.log(text);
console.log(agentCalls);                    // trace of which agent did what

// Six strategies in total. See /features/agency-api for the full reference.`,

  'Streaming': `import { streamText, agent } from '@framers/agentos';

// streamText() yields token deltas as they arrive. Breaking out of the loop
// ends the stream, and the OpenAI provider cancels its HTTP response.
const { textStream, usage } = streamText({
  provider: 'openai',
  model: 'gpt-4o',
  prompt: 'Explain how QUIC differs from TCP at the wire level.',
});
for await (const delta of textStream) {
  process.stdout.write(delta);
}
console.log(\`\\n\\nTotal tokens: \${(await usage).totalTokens}\`);

// A session's stream() returns the same kind of result. fullStream yields
// text, tool-call, tool-result and error parts in order; the reply joins the
// session's history once its text promise resolves.
const support = agent({
  provider: 'openai',
  instructions: 'You are a senior platform engineer.',
});
const session = support.session('user-42');

const reply = session.stream('Why is gRPC slow over satellite?');
for await (const part of reply.fullStream) {
  switch (part.type) {
    case 'text':        process.stdout.write(part.text);                 break;
    case 'tool-call':   console.log('\\n[tool]', part.toolName);          break;
    case 'tool-result': console.log('\\n[result]', part.toolName);        break;
    case 'error':       console.error('\\n[error]', part.error.message);  break;
  }
}`,

  'Multimodal RAG': `import {
  MultimodalIndexer,
  LLMVisionAdapter,
  SpeechProviderAdapter,
  InMemoryVectorStore,
  type IEmbeddingManager,
} from '@framers/agentos/cognition/rag';
import { OpenAIWhisperSpeechToTextProvider } from '@framers/agentos/speech';
import fs from 'node:fs';

// The embedding manager your text RAG already uses.
declare const embeddingManager: IEmbeddingManager;

const vectorStore = new InMemoryVectorStore();
await vectorStore.initialize({ id: 'media', type: 'in_memory' });
await vectorStore.createCollection('multimodal', 1536);   // the embedding model's dimension

// An image becomes a vision model's description and audio an STT transcript;
// each text is embedded and stored with its modality.
const indexer = new MultimodalIndexer({
  embeddingManager,
  vectorStore,
  visionProvider: new LLMVisionAdapter({ provider: 'openai', model: 'gpt-4o-mini' }),
  sttProvider: new SpeechProviderAdapter(
    new OpenAIWhisperSpeechToTextProvider({ apiKey: process.env.OPENAI_API_KEY! }),
  ),
});

await indexer.indexImage({ image: fs.readFileSync('./figures/revenue-chart.png') });
await indexer.indexAudio({ audio: fs.readFileSync('./calls/sales-q4.wav'), language: 'en' });
await indexer.indexText({ text: 'Revenue grew 23% to $4.2B, driven by cloud services.' });

// One text query over every modality in the collection.
const hits = await indexer.search('Q4 revenue growth drivers', { topK: 5 });
for (const hit of hits) {
  console.log(\`[\${hit.modality}] \${hit.content.slice(0, 80)} (\${hit.score.toFixed(2)})\`);
}`,

  'Media Generation': `import { generateText, streamText, generateImage, agent } from '@framers/agentos';

// Text: name the provider and its default model answers
const { text } = await generateText({ provider: 'openai', prompt: 'Explain QUIC.' });

// Images: cloud providers, or a local Stable Diffusion server
// (Automatic1111, Forge or ComfyUI)
const poster = await generateImage({
  provider: 'stability',
  model: 'stable-image-core',
  prompt: 'Art deco travel poster for a moon colony',
  providerOptions: { stability: { negativePrompt: 'text, watermark' } },
});

// Streaming
for await (const delta of streamText({ provider: 'anthropic', prompt: 'Compare TCP vs UDP.' }).textStream) {
  process.stdout.write(delta);
}

// Stateful agent with sessions and personality
const tutor = agent({
  provider: 'openai',
  instructions: 'You are a networking tutor.',
  personality: { openness: 0.9, conscientiousness: 0.8 },  // HEXACO
});
const session = tutor.session('demo');
await session.send('What is QUIC?');
await session.send('How does it compare to HTTP/2?');`,

  'Deep Research': `import { mission, toolNode } from '@framers/agentos/orchestration';
import type { WorkflowRuntimeDeps } from '@framers/agentos/orchestration/builders/WorkflowBuilder';
import { z } from 'zod';

// Your runtime's executors: tool calls, the reasoning loop and the model call.
declare const deps: WorkflowRuntimeDeps;

// The compiler turns the goal into a linear plan from a template (the
// research style: gather, process, deliver and refine steps) and splices
// anchor nodes into it.
const researcher = mission('deep-research')
  .input(z.object({ topic: z.string() }))
  .goal('Research the topic in the input and produce a cited summary')
  .returns(z.object({ summary: z.string(), confidence: z.number() }))
  .planner({ strategy: 'linear', maxSteps: 8, style: 'research' })
  .anchor('fact-check', toolNode('grounding_verifier'), { phase: 'validate', required: true })
  .compile({ deps });

const plan = await researcher.explain({ topic: 'AI safety' });  // the steps and the graph
const result = await researcher.invoke({ topic: 'AI safety' });  // run it`,

  'Voice Calls': `import { CallManager, TwilioVoiceProvider, twilioConversationTwiml } from '@framers/agentos';

const manager = new CallManager({
  provider: {
    provider: 'twilio',
    config: {
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      fromNumber: '+15551234567',
    },
  },
  webhookBaseUrl: 'https://your-domain.com',
  inboundPolicy: 'allowlist',
  allowedNumbers: ['+15550001111'],
});
manager.registerProvider(new TwilioVoiceProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
}));

// Place a call. Twilio requests <webhookBaseUrl>/voice/webhook/twilio when it
// connects, and your route answers with TwiML that opens a media stream.
const call = await manager.initiateCall({ toNumber: '+15550001234' });
const twiml = twilioConversationTwiml('wss://your-domain.com/voice/media-stream', call.callId);

// Key presses and state changes arrive as events.
manager.on((event) => {
  if (event.type === 'call:dtmf') console.log('pressed', (event.data as { digit: string }).digit);
});

// On the media stream WebSocket, TelephonyStreamTransport turns caller audio
// into Float32 frames for VAD and STT and sends TTS audio back as mu-law.`,

  'Emergent Tools': `import { AgentOS } from '@framers/agentos';

// Emergent capabilities: the agent gets forge_tool and can build a tool
// mid-conversation.
const agentos = await AgentOS.create({
  emergent: true,
  emergentConfig: {
    maxSessionTools: 10,
    allowSandboxTools: true,         // generated code; off by default
    sandboxTimeoutMs: 5000,
    judgeModel: 'gpt-4o-mini',       // LLM-as-judge for each forged tool
  },
});

// A forged tool composes existing tools, or runs generated JavaScript in a
// node:vm context or a QuickJS WebAssembly instance. Its test cases run, and
// no tool activates without the judge's approval.

// Tools start at the session tier. Five or more uses at confidence 0.8 or
// higher, with a two-reviewer panel's approval, promote a tool to the agent
// tier; the shared tier takes an explicit promote() call.

// Export a forged tool as a portable YAML package:
// wunderland emergent export <name|id> --output ./my-tool.emergent-tool.yaml`,

  'Video & Audio': `import { generateVideo, analyzeVideo, generateMusic, generateSFX } from '@framers/agentos';

// Text-to-video on a named provider, or the first one whose key is set
const video = await generateVideo({
  prompt: 'A drone flying over a misty forest at sunrise',
  provider: 'runway',
  durationSec: 5,
});
console.log(video.videos[0].url);

// Video analysis: scenes, a description of each, a transcript and a summary
// (needs ffmpeg and ffprobe on the PATH)
const analysis = await analyzeVideo({
  videoUrl: 'https://example.com/demo.mp4',
  transcribeAudio: true,
});
console.log(analysis.scenes);

// Music: the first configured provider, with the others as fallbacks
const music = await generateMusic({
  prompt: 'Upbeat lo-fi hip hop beat with vinyl crackle and mellow piano',
  durationSec: 60,
});

// Sound effects
const sfx = await generateSFX({
  prompt: 'Thunder crack followed by heavy rain on a tin roof',
  durationSec: 5,
});`,

  AgentGraph: `import { AgentGraph, toolNode, gmiNode, START, END } from '@framers/agentos/orchestration';
import type { WorkflowRuntimeDeps } from '@framers/agentos/orchestration/builders/WorkflowBuilder';
import { z } from 'zod';

// Your runtime's executors: toolOrchestrator runs tool nodes,
// loopController and providerCall run gmi nodes.
declare const deps: WorkflowRuntimeDeps;

const graph = new AgentGraph(
  {
    input: z.object({ topic: z.string() }),
    scratch: z.object({}),
    artifacts: z.object({ search: z.unknown(), summarize: z.string() }),
  },
  { checkpointPolicy: 'every_node' },        // a checkpoint after each node
)
  // A tool node sends its tool the static args and nothing from the state.
  .addNode('search', toolNode('web_search', { args: { query: 'quantum computing' } }))
  .addNode('summarize', gmiNode({ instructions: 'Write a cited summary of the search results.' }))
  .addEdge(START, 'search')
  .addEdge('search', 'summarize')
  .addEdge('summarize', END)
  .compile({ deps });

const result = await graph.invoke({ topic: 'quantum computing' });`,
};

function QuickStartTabs() {
  const tabs = Object.keys(quickStartCode) as Array<keyof typeof quickStartCode>;
  const [active, setActive] = useState(tabs[0]);
  return (
    <section style={{ padding: '2rem 2rem 1rem', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Quick Start</h2>
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '6px 6px 0 0',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.8rem',
              fontWeight: active === tab ? 700 : 400,
              background: active === tab ? 'var(--ifm-color-primary)' : 'transparent',
              color: active === tab ? '#fff' : 'var(--ifm-font-color-base)',
              opacity: active === tab ? 1 : 0.6,
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <CodeBlock language={active.includes('YAML') ? 'yaml' : 'typescript'}>
        {quickStartCode[active]}
      </CodeBlock>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Architecture Diagram (hand-crafted SVG)                            */
/* ------------------------------------------------------------------ */

function ArchitectureDiagram() {
  return (
    <section style={{ padding: '3rem 2rem 1rem', maxWidth: '1240px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>System Architecture</h2>
      <p style={{ textAlign: 'center', fontSize: '0.85rem', opacity: 0.65, marginBottom: '1.25rem' }}>
        Seven cooperating layers. API surface at the top, channels and providers at the floor, cognition and memory in the middle. Click to zoom.
      </p>
      <div style={{ overflow: 'auto' }}>
        <DiagramImg
          src="/img/diagrams/system-architecture.svg"
          alt="AgentOS layered architecture: 7 cooperating layers from API surface (generateText, streamText, agent, agency, mission) through cognitive substrate (GMI coordinator, PersonaOverlayManager, SentimentTracker, MetapromptExecutor), memory and RAG pipeline (working / episodic / semantic / observational memory, 8 cognitive mechanisms, HyDE, GraphRAG, 7 vector backends), tools and capabilities (ToolOrchestrator, 100+ extension packs, 88 SKILL.md modules, CapabilityDiscovery, ForgeToolMetaTool), guardrails and HITL (GuardrailDispatcher, 4-tier PII redaction, ML classifiers, Grounding Guard, HumanInteract), orchestration (workflow, mission, AgentGraph, CompiledExecutionGraph, CheckpointStore), down to I/O and providers (voice pipeline, channels, media generation, 13 LLM providers, OpenRouter fanout)."
          style={{ width: '100%', height: 'auto', borderRadius: '12px' }}
        />
      </div>
      <p style={{ textAlign: 'center', marginTop: '0.75rem' }}>
        <Link to="/architecture/system-architecture" style={{ fontSize: '0.9rem' }}>
          Full architecture guide &rarr;
        </Link>
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature Cards                                                      */
/* ------------------------------------------------------------------ */

const features = [
  {
    title: 'Multimodal Provider API',
    description:
      'Text, images, video, music, SFX, embeddings, and speech from one API. Cloud and local backends share the same surface, with fallback chains and provider preferences that order, filter or weight them.',
    link: '/features/multimodal-rag',
  },
  {
    title: 'Deep Research Agents',
    description:
      'mission() compiles a goal into a linear step graph from a plan template (research, Q&A or creative), with anchor nodes for verification and human review spliced into its phases.',
    link: '/features/rag-memory#query-classification',
  },
  {
    title: 'Emergent Capabilities',
    description:
      'Agents forge new tools at runtime \u2014 compose (chain existing tools) or sandbox (generated JavaScript in node:vm or QuickJS, with allowlists; off by default). LLM-as-judge review, tiered promotion, portable YAML export.',
    link: '/features/emergent-capabilities',
  },
  {
    title: 'Voice & IVR Pipeline',
    description:
      'Voice pipeline with VAD, STT, endpoint detection and TTS, and Twilio, Telnyx and Plivo call providers with a media-stream transport for phone calls.',
    link: '/features/voice-pipeline',
  },
  {
    title: 'Graph Orchestration',
    description:
      'Three authoring APIs \u2014 AgentGraph, workflow() DSL, mission() \u2014 compile to one IR. judgeNode for evaluation, checkpoints to resume from, streaming events.',
    link: '/features/unified-orchestration',
  },
  {
    title: 'Cognitive Memory',
    description:
      'Ebbinghaus decay, spreading activation, Baddeley-style working memory, GraphRAG retrieval and consolidation, plus 8 neuroscience-grounded mechanisms that run with a cognitiveMechanisms config and that HEXACO traits modulate.',
    link: '/features/cognitive-memory',
  },
  {
    title: 'Streaming Guardrails',
    description:
      'Five guardrail packs: PII redaction (regex, NLP, NER and an LLM judge), ML classifiers (ONNX toxic-bert, an LLM judge or keywords), topicality (embedding similarity to allowed and blocked topics), code safety (OWASP-style rules) and grounding (NLI against the retrieved sources).',
    link: '/features/guardrails',
  },
  {
    title: 'Evaluation Framework',
    description:
      'Test cases scored by built-in or custom scorers and an LLM judge with criteria presets. Two runs compared side by side; reports in JSON, Markdown or HTML.',
    link: '/features/evaluation-guide',
  },
  {
    title: 'Capability Discovery',
    description:
      'Three tiers held to token budgets: category summaries (200 tokens) \u2192 the top 5 matches (800) \u2192 full schemas for the top 2 (2,000), plus a discover_capabilities tool for active search.',
    link: '/features/capability-discovery',
  },
  {
    title: 'Provenance & Audit',
    description:
      'Signed event ledger (Ed25519 signatures over a SHA-256 hash chain), revision snapshots, tombstones for deletes, an autonomy guard, and Merkle roots anchored outside the database.',
    link: '/features/provenance-immutability',
  },
  {
    title: 'Channels & Social',
    description:
      'Telegram, Discord, Slack, WhatsApp, Twitter/X, LinkedIn, Bluesky, Mastodon, and custom adapters. Multi-channel routing, social publishing, browser automation, and adapter APIs.',
    link: '/features/channels',
  },
  {
    title: 'Immutable Agents',
    description:
      'Sealed storage policy with the signed ledger, revisions, tombstones and anchors, and a design guide for toolset pinning, secret rotation and forgetting. A sealed agent\'s changes are tamper-evident.',
    link: '/features/immutable-agents',
  },
  {
    title: 'Video & Audio Generation',
    description:
      'generateVideo(), analyzeVideo(), detectScenes(), generateMusic(), generateSFX() APIs. 3 video providers (Runway, Replicate, Fal) + 8 audio providers. Fallback chains and scene detection.',
    link: '/features/video-pipeline',
  },
  {
    title: 'Curated Skills',
    description:
      'SKILL.md prompt modules for research, developer tools, communication, productivity, security, media, and creative workflows. Semantic discovery finds the right skill per turn.',
    link: '/skills',
  },
  {
    title: 'Self-Improving Agents',
    description:
      'Bounded self-modification: adapt_personality (HEXACO mutation with per-session budgets), manage_skills, create_workflow, self_evaluate. Recorded mutations decay when adapt_personality runs; the live trait keeps its change.',
    link: '/features/self-improving-agents',
  },
];

function Features() {
  return (
    <section style={{ padding: '3rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Core Features</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          gap: '1.25rem',
        }}
      >
        {features.map(({ title, description, link }) => (
          <Link key={title} to={link} className="feature-card">
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.05rem' }}>{title}</h3>
            <p style={{ opacity: 0.7, margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
              {description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function Home(): React.JSX.Element {
  return (
    <Layout description="AgentOS \u2014 open-source TypeScript runtime for autonomous AI agents with unified graph orchestration, cognitive memory, streaming guardrails, and voice pipeline.">
      <Hero />
      <ContactCTAs />
      <ForgeDemoSection />
      <InstallTabs />
      <QuickStartTabs />
      <ArchitectureDiagram />
      <Features />
    </Layout>
  );
}
