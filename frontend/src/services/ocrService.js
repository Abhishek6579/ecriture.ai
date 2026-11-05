// Configure in frontend/.env.local (see .env.example).
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const API_KEY = import.meta.env.VITE_API_KEY;

// Sends an image to the backend's POST /ocr and resolves to { filename, text, characters }.
export async function recognizeImage(file) {
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
    throw new Error(`Can't reach the OCR service at ${API_URL}.`);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || `OCR request failed with status ${response.status}.`);
  }

  return data;
}
