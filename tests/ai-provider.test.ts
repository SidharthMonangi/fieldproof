import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAnswer } from '../lib/ai-provider.ts';
const payload = {
  instructions: 'Use the source.',
  input: 'Fictional evidence.',
  text: { format: { schema: { type: 'object' } } },
};
test('a Gemini provider failure never silently uses the paid provider', async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    calls.push(url);
    return new Response('limited', { status: 429 });
  });
  const result = await generateAnswer(payload, {
    GEMINI_API_KEY: 'fictional-secret',
    OPENAI_API_KEY: 'fictional-paid-secret',
  });
  assert.equal(result.status, 429);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith('https://generativelanguage.googleapis.com/'));
});
test('Gemini credentials stay out of request URLs and generated prompts', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.ok(!url.includes('fictional-secret'));
    assert.ok(!String(options.body).includes('fictional-secret'));
    assert.equal((options.headers as Record<string, string>)['x-goog-api-key'], 'fictional-secret');
    return Response.json({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }],
    });
  });
  assert.equal((await generateAnswer(payload, { GEMINI_API_KEY: 'fictional-secret' })).status, 200);
});
test('truncated provider answers are rejected rather than presented as complete', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"answer":' }] } }],
    }),
  );
  await assert.rejects(
    generateAnswer(payload, { GEMINI_API_KEY: 'fictional-secret' }),
    /Incomplete/,
  );
});
