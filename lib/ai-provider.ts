// Keep credentials on the server. Normalize providers to the existing answer contract.
export async function generateAnswer(
  payload: {
    instructions: string;
    input: string;
    text: { format: { schema: unknown; [key: string]: unknown } };
    [key: string]: unknown;
  },
  config: { GEMINI_API_KEY?: string; GEMINI_MODEL?: string; OPENAI_API_KEY?: string },
) {
  if (!config.GEMINI_API_KEY)
    return fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.OPENAI_API_KEY,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify(payload),
    });
  const model = config.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Invalid model name');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': config.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: payload.instructions }] },
        contents: [{ role: 'user', parts: [{ text: payload.input }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: payload.text.format.schema,
          maxOutputTokens: 1800,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!response.ok) return response;
  const result = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { totalTokenCount?: number };
  };
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') throw new Error('Incomplete generated answer');
  return Response.json({
    output: [
      {
        content: [
          {
            type: 'output_text',
            text: candidate.content?.parts?.map((p) => p.text || '').join(''),
          },
        ],
      },
    ],
    usage: { total_tokens: result.usageMetadata?.totalTokenCount || 0 },
  });
}
