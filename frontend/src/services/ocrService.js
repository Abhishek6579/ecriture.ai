// Configure in frontend/.env.local (see .env.example).
const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const API_URL = (configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/+$/, '');
const API_KEY = import.meta.env.VITE_API_KEY;

// Sends an image to the backend's POST /ocr and resolves to { filename, text, characters }.
export async function recognizeImage(file) {
  if (!API_URL) {
    throw new Error('The OCR service is not configured. Set VITE_API_URL to your hosted FastAPI URL in Vercel → Project Settings → Environment Variables, then redeploy.');
  }

  if (!import.meta.env.DEV && /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(API_URL)) {
    throw new Error('VITE_API_URL points to localhost. Set it to your public hosted FastAPI URL in Vercel, then redeploy.');
  }

  const body = new FormData();
  body.append('file', file);

  let response;

  try {
    response = await fetch(`${API_URL}/ocr`, {
      method: 'POST',
      headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
      body,
    });
  } catch {
    throw new Error(`Can't reach the OCR service at ${API_URL}. Check that the backend is running and that ALLOWED_ORIGINS includes this website's origin.`);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || `OCR request failed with status ${response.status}.`);
  }

  return data;
}
