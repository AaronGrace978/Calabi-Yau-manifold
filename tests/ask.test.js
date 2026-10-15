import test from 'node:test';
import assert from 'node:assert/strict';
import { extractToken, buildPayload, parseShowDirective, systemPrompt } from '../src/lab/ask.js';

test('extractToken reads every provider stream shape', () => {
  assert.deepEqual(extractToken({ message: { content: 'hi' } }), { token: 'hi', thinking: false });
  assert.deepEqual(extractToken({ message: { thinking: 'hmm' } }), { token: 'hmm', thinking: true });
  assert.deepEqual(extractToken({ choices: [{ delta: { content: 'a' } }] }), { token: 'a', thinking: false });
  assert.deepEqual(extractToken({ choices: [{ delta: { reasoning_content: 'r' } }] }), { token: 'r', thinking: true });
  assert.deepEqual(extractToken({ delta: { text: 'b' } }), { token: 'b', thinking: false });
  assert.deepEqual(extractToken({ candidates: [{ content: { parts: [{ text: 'g' }] } }] }), { token: 'g', thinking: false });
  assert.deepEqual(extractToken({}), { token: '', thinking: false });
});

test('buildPayload puts the system prompt where each provider expects it', () => {
  assert.equal(buildPayload('anthropic', 'm', 'q', 'sys').system, 'sys');
  assert.equal(buildPayload('google', 'm', 'q', 'sys').systemInstruction.parts[0].text, 'sys');
  const ollama = buildPayload('ollama-cloud', 'm', 'q', 'sys');
  assert.equal(ollama.messages[0].role, 'system');
  assert.equal(ollama.think, false);
  assert.equal(buildPayload('openai', 'm', 'q', 'sys').messages[1].content, 'q');
});

test('parseShowDirective only accepts known space ids', () => {
  const ids = ['hopf', 'e8'];
  assert.equal(parseShowDirective('Linked circles.\nSHOW: hopf', ids), 'hopf');
  assert.equal(parseShowDirective('SHOW: E8', ids), 'e8');
  assert.equal(parseShowDirective('SHOW: rm -rf', ids), null);
  assert.equal(parseShowDirective('no directive', ids), null);
});

test('systemPrompt carries the on-screen context and the list of ids', () => {
  const s = systemPrompt({ title: 'Hopf fibration', settings: 'rings = 3', facts: '- Map: S³ → S²' }, ['hopf', 'e8']);
  assert.match(s, /Hopf fibration/);
  assert.match(s, /rings = 3/);
  assert.match(s, /hopf, e8/);
});
