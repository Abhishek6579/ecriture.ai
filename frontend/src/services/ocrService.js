// The Supabase access token authenticates each protected API request. No shared
// backend API key is sent to the browser.
const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();
export const API_URL = (configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 180_000;

export class ApiError extends Error {
  constructor(message, { status = 0, code = null, payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

function validateApiUrl() {
  if (!API_URL) {
    throw new ApiError('The OCR service is not configured. Set VITE_API_URL to your hosted FastAPI URL in Vercel, then redeploy.');
  }
  if (!import.meta.env.DEV && /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(API_URL)) {
    throw new ApiError('VITE_API_URL points to localhost. Set it to your public hosted FastAPI URL in Vercel, then redeploy.');
  }
}

async function request(path, { accessToken, ...options } = {}) {
  validateApiUrl();
  if (!accessToken) {
    throw new ApiError('Your session has expired. Sign in again.', { status: 401, code: 'unauthenticated' });
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      throw new ApiError('The OCR service took too long to respond. Try again, or use a smaller image.');
    }
    throw new ApiError(`Can't reach the OCR service at ${API_URL}. Check that the backend is running and that ALLOWED_ORIGINS includes this website's origin.`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === 'string'
      ? detail
      : detail?.message || `OCR request failed with status ${response.status}.`;
    throw new ApiError(message, {
      status: response.status,
      code: typeof detail === 'object' ? detail?.code : null,
      payload: detail || data,
    });
  }
  return data;
}

export async function recognizeImage(file, accessToken) {
  const body = new FormData();
  body.append('file', file);
  return request('/ocr', { method: 'POST', body, accessToken });
}

export async function fetchUsage(accessToken) {
  return request('/api/me/usage', { method: 'GET', accessToken });
}
