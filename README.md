<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# HumSync

HumSync turns hummed melody ideas into usable 8 or 16 bar creator loops.

The v1 workflow is:

1. Capture a hummed idea.
2. Analyze pitch, rhythm, rests, confidence, and suggested key locally.
3. Clean the hum into quantized notes while preserving the melody contour.
4. Arrange a playable local synth loop with guided producer controls.
5. Export WAV and MIDI, with optional Lyria enhancement when available.

View your app in AI Studio: https://ai.studio/apps/79ba5da3-d213-4d06-b4c5-e316a2dc0bd4

## Run Locally

**Prerequisites:** Node.js 20+ and a Gemini API key.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your Gemini API key to [.env.local](.env.local):

   ```bash
   GEMINI_API_KEY="your_api_key_here"
   APP_URL="http://localhost:3000"
   ```

3. Run the UI-only Vite app:

   ```bash
   npm run dev
   ```

4. Run the full Vercel app, including `/api/*` functions:

   ```bash
   npm run dev:vercel
   ```

5. Open http://localhost:3000.

## Useful Scripts

- `npm run dev` starts the local Vite dev server.
- `npm run dev:vercel` starts the local app with Vercel API routes.
- `npm run lint` runs TypeScript checks.
- `npm run test` runs the hum analysis and MIDI export unit tests.
- `npm run build` creates a production build in `dist/`.
