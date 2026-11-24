# PrismVoice — Multilingual Visual Q&A & Speech Studio

An installable Progressive Web App (PWA) and full-stack web application for visual question answering, OCR translation across 16 languages, region-of-interest focus, and neural text-to-speech playback.

## Features

- **Visual Input**: Upload images (`PNG`, `JPEG`, `WEBP`, `GIF`), capture live snapshots from your camera, or explore three built-in sample scenes.
- **Focus Region Selection**: Drag a bounding box over any sign, label, or object to target your question.
- **4 Analysis Modes**: General Q&A, Read & Translate Text (OCR), Scene Accessibility, and Object Breakdown.
- **16-Language Output & Instant Re-Translation**: Switch any answer's language inline without re-uploading the image.
- **Neural Spoken Audio & Voice Dictation**: Generate 24 kHz WAV speech across five selectable voices (`Kore`, `Puck`, `Charon`, `Fenrir`, `Zephyr`), adjust playback speed, download `.wav` files, or speak questions via microphone.
- **Installable PWA**: Works as both a public website and an installable desktop/mobile app with offline caching for static assets and sample scenes.

## Local Development

```bash
npm install
cp .env.example .env
# Configure GEMINI_API_KEY (or Vertex AI ADC + GOOGLE_CLOUD_PROJECT) in .env
npm run dev
```

Open `http://localhost:3000`.

## Deploy to Google Cloud Run + Vertex AI

1. **Authenticate & select your Google Cloud project**:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Enable Vertex AI, Cloud Run, Cloud Build, and Artifact Registry**:
   ```bash
   gcloud services enable aiplatform.googleapis.com run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```

3. **Grant Vertex AI permissions to your Cloud Run service account**:
   ```bash
   PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   ```

4. **Build and deploy from source** (uses the included `Dockerfile`):
   ```bash
   gcloud run deploy prismvoice \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1,VQA_MODEL=gemini-2.5-flash,TRANSCRIBE_MODEL=gemini-2.5-flash"
   ```

   > Note: Set `VQA_MODEL`, `TTS_MODEL`, and `TRANSCRIBE_MODEL` to the Vertex AI model IDs enabled in your chosen region. If you prefer API-key authentication instead of Vertex AI IAM, pass `--set-env-vars="GEMINI_API_KEY=..."` instead.
