<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1J1xRn5uClDuZAVSe5Vuh8zL1qrjrE8Ma

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Performance & Architecture Best Practices

### Global State & Persistence
The application uses Zustand with `persist` middleware for state management. This writes state changes to `localStorage` synchronously.

**CRITICAL RULE:** Do NOT use persisted state for high-frequency updates (e.g., typing animations, progress bars, mouse tracking).
- **Bad:** Updating `activeChatMessages` 50 times/second during AI streaming. This will freeze the UI.
- **Good:** Use `currentStreamContent` (non-persisted) or local component state for high-frequency data. Only update the persisted store once the operation is complete.

See `hooks/useAIStream.ts` for the reference implementation of this pattern.
