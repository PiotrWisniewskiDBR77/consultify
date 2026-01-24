/**
 * Manual mock for @google/generative-ai
 */

class GoogleGenerativeAI {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  getGenerativeModel({ model }) {
    return {
      generateContent: async (prompt) => {
        return {
          response: {
            text: () => JSON.stringify([{ title: 'Mock Recommendation', priority: 'HIGH' }]),
            candidates: [{ content: { parts: [{ text: 'Mock AI Response' }] } }],
          },
        };
      },
      generateContentStream: async function* () {
        yield { text: () => 'Mock' };
        yield { text: () => ' Stream' };
      },
      countTokens: async () => ({ totalTokens: 100 }),
    };
  }
}

const HarmCategory = {
  HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
  HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
  HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
};

const HarmBlockThreshold = {
  BLOCK_NONE: 'BLOCK_NONE',
  BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE',
  BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
  BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH',
};

export { GoogleGenerativeAI };
export { HarmCategory };
export { HarmBlockThreshold };
