export const GENERATED_IMAGE_TEXT_THRESHOLD = 2;

export type FaceDetector = (image: Buffer) => Promise<{ hasFace: boolean }>;

export async function detectTextInGeneratedImage(
  image: Buffer
): Promise<{ hasText: boolean; text: string }> {
  const tesseract = await import('tesseract.js');
  const result = await tesseract.recognize(image, 'eng+pol');
  const text = String(result?.data?.text || '').trim();
  return { hasText: text.length > GENERATED_IMAGE_TEXT_THRESHOLD, text };
}

function parseFaceAnswer(value: unknown): boolean {
  const answer = String(value || '')
    .trim()
    .toLowerCase();
  if (answer === 'yes') return true;
  if (answer === 'no') return false;
  throw new Error(`Ambiguous face detector response: ${answer.slice(0, 40) || '<empty>'}`);
}

export function createVisionFaceDetector(params: {
  provider: string;
  apiKey: string;
  endpoint?: string | null;
}): FaceDetector {
  return async (image) => {
    const provider = params.provider.toLowerCase();
    const imageUrl = `data:image/png;base64,${image.toString('base64')}`;
    if (provider === 'openai') {
      const endpoint = params.endpoint || 'https://api.openai.com/v1/chat/completions';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${params.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          max_tokens: 3,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Is any human face visible? Answer only yes or no.' },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
        }),
      });
      if (!response.ok) throw new Error(`OpenAI face detection failed (${response.status})`);
      const json: any = await response.json();
      return { hasFace: parseFaceAnswer(json?.choices?.[0]?.message?.content) };
    }

    if (provider === 'gemini' || provider === 'google') {
      const endpoint =
        params.endpoint ||
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(params.apiKey)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: 'Is any human face visible? Answer only yes or no.' },
                { inlineData: { mimeType: 'image/png', data: image.toString('base64') } },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 3 },
        }),
      });
      if (!response.ok) throw new Error(`Gemini face detection failed (${response.status})`);
      const json: any = await response.json();
      return { hasFace: parseFaceAnswer(json?.candidates?.[0]?.content?.parts?.[0]?.text) };
    }

    throw new Error(`No supported vision face detector for provider=${provider}`);
  };
}
