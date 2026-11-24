# PrismVoice — Multilingual Visual Q&A & Speech Studio

An installable Progressive Web App (PWA) and full-stack web application for visual question answering, OCR translation across 16 languages, region-of-interest focus, and neural text-to-speech playback.

## Features

- **Visual Input**: Upload images (`PNG`, `JPEG`, `WEBP`, `GIF`), capture live snapshots from your camera, or explore three built-in sample scenes.
- **Focus Region Selection**: Drag a bounding box over any sign, label, or object to target your question.
- **4 Analysis Modes**: General Q&A, Read & Translate Text (OCR), Scene Accessibility, and Object Breakdown.
- **16-Language Output & Instant Re-Translation**: Switch any answer's language inline without re-uploading the image.
- **Neural Spoken Audio & Voice Dictation**: Generate 24 kHz WAV speech across five selectable voices (`Kore`, `Puck`, `Charon`, `Fenrir`, `Zephyr`), adjust playback speed, download `.wav` files, or speak questions via microphone.
- **Installable PWA**: Works as both a public website and an installable desktop/mobile app with offline caching for static assets and sample scenes.

## Local Setup

```bash
npm install
cp .env.example .env
# Set GEMINI_API_KEY in .env
npm run dev
```

Open `http://localhost:3000`.

## Production Hosting & Deployment

1. **Build the frontend & PWA bundle**:
   ```bash
   npm run build
   ```
2. **Start the production Node/Express server**:
   ```bash
   NODE_ENV=production npm start
   ```
3. **Environment Variables**:
   - `GEMINI_API_KEY` (required): Server-side Gemini API key.
   - `PORT` (optional): Defaults to `3000`.

Works seamlessly on Google Cloud Run, Render, Railway, Fly.io, or any Node.js hosting provider.
