import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Checks the words of the soul-files diagram against fixed statements taken from agentos's
// docs/SOUL_FILES.md about what the loader and the agent do with each file of a soul workspace.
// The test holds those statements itself and does not read the docs, so a change to that page
// that changes what the diagram should say means changing the assertions here as well. The page
// shows the diagram, so a label the page contradicts misleads the reader of the page.

const DIAGRAMS = resolve(dirname(fileURLToPath(import.meta.url)), '../static/img/diagrams');
const SOUL = ['soul-files-anatomy.svg', 'soul-files-anatomy-dark.svg'];

/** The words an SVG shows: its title, its description and every text element, in order. */
function wordsOf(svg) {
  // The opening tag may not end in "/": a self-closing element holds no words of its own.
  return [...svg.matchAll(/<(title|desc|text)\b(?:[^>]*[^>/])?>([\s\S]*?)<\/\1>/g)].map(([, , inner]) =>
    inner.replace(/\s+/g, ' ').trim(),
  );
}

/** The words a diagram file shows. */
function words(file) {
  return wordsOf(readFileSync(resolve(DIAGRAMS, file), 'utf8'));
}

test('the word reader keeps an empty self-closing text element apart from the next label', () => {
  assert.deepEqual(wordsOf('<svg><text x="1"/><text x="2">memory/</text></svg>'), ['memory/']);
});

test('the soul-files diagram says the same in both themes', () => {
  assert.deepEqual(words(SOUL[1]), words(SOUL[0]));
});

for (const file of SOUL) {
  const text = () => words(file).join('\n');

  test(`${file} draws the memory/ wiki and its index.md, not a MEMORY.md of facts and daily logs`, () => {
    assert.ok(words(file).includes('memory/'), 'a label reads exactly memory/');
    assert.doesNotMatch(text(), /MEMORY\.md/);
    assert.match(text(), /index\.md/);
    assert.match(text(), /entities\/ · concepts\/ · log\//);
    assert.doesNotMatch(text(), /long-term facts/);
    assert.doesNotMatch(text(), /MEMORY\.md \+ daily logs/);
    assert.doesNotMatch(text(), /auto-writes daily logs/);
  });

  test(`${file} draws hard limits as prompt text, not as an enforced guardrail`, () => {
    assert.doesNotMatch(text(), /guardrail/i);
    assert.doesNotMatch(text(), /enforced as/);
    assert.match(text(), /not an enforced check/);
  });

  test(`${file} draws AGENTS.md and IDENTITY.md as returned by loadSoul(), not by the agent, and examples/ as not read`, () => {
    assert.doesNotMatch(text(), /Behavioral Rules/);
    assert.doesNotMatch(text(), /Output Calibration/);
    assert.doesNotMatch(text(), /Returned to Host/);
    assert.ok(words(file).includes('From loadSoul()'), 'a panel heading reads exactly From loadSoul()');
    assert.doesNotMatch(text(), /WHAT THE BUILT AGENT GETS/);
    assert.match(text(), /examples\/ not read/);
  });

  test(`${file} claims no mood model, voice field or cache the loader does not have`, () => {
    assert.doesNotMatch(text(), /PAD-tagged/);
    assert.doesNotMatch(text(), /prosody/);
    assert.doesNotMatch(text(), /cache to per-agent state/);
  });

  test(`${file} draws mood and voice only on the paths that apply them`, () => {
    // agent() renders the traits but has no renderer for mood or voice; gmi applies mood, the
    // full runtime takes every field.
    assert.doesNotMatch(text(), /HEXACO traits · mood · voice/);
    assert.doesNotMatch(text(), /Persona Card/);
    assert.match(text(), /mood on gmi and the full runtime/);
  });

  test(`${file} says systemBlocks replace the assembled prompt`, () => {
    assert.match(text(), /systemBlocks replace/);
  });
}
