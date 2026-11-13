# ecriture.ai

Full-page printed-text OCR with a two-stage DBNet + TrOCR pipeline, a React/Vite workspace, and a FastAPI backend. This repository now includes Supabase authentication, per-account lifetime scan quotas, and a GitHub Actions CI/CD workflow that publishes the production backend to Docker Hub and deploys it to Azure Container Apps.

## Architecture

### OCR pipeline

1. **DBNet detection** — `DB_TD500_resnet50.onnx` locates text regions.
2. **Reading-order reconstruction** — detected polygons are grouped into rows and sorted left-to-right.
3. **Crop rectification and filtering** — perspective correction, optional splitting for very wide lines, and a low-variance crop filter.
4. **TrOCR recognition** — line crops are passed to the configured PyTorch or ONNX recognizer.

Inference is serialized through a process-level lock to avoid CPU oversubscription and memory spikes.

### Authentication and scan quota

- Supabase Auth provides Google OAuth and email/password sign-in.
- The browser sends the user's Supabase access token as `Authorization: Bearer ...`.
- FastAPI verifies the token and (by default) checks the current Supabase Auth user record to require a confirmed email.
- PostgreSQL stores a profile and scan counter per account.
- A Postgres RPC function atomically reserves a scan before inference. Concurrent requests cannot exceed the configured allowance.
- Invalid/undecodable uploads do not consume a scan. An inference exception attempts to refund the reservation.
- Uploaded images are processed in memory and are not written to disk. The database stores scan metadata only (timestamp, status, and character count).

The default free allowance is **5 lifetime scans per account**. Change it with `FREE_SCAN_LIMIT` on the backend. This is an account-level limit, not a daily reset. An optional global daily cap can be enabled using `GLOBAL_DAILY_SCAN_LIMIT` (default `0`, disabled).

## Repository structure

```text
ecriture.ai/
├── .github/
│   ├── workflows/backend.yml       # Backend tests + Docker build/startup smoke check
│   └── dependabot.yml              # Weekly Python, Docker and Actions update PRs
├── backend/
│   ├── main.py                     # FastAPI routes, quota gate and OCR invocation
│   ├── auth.py                     # Supabase JWT and verified-email checks
│   ├── quota_store.py               # Supabase PostgREST RPC client
│   ├── ocr_engine.py                # DBNet + TrOCR inference
│   ├── preprocess.py                # Image preprocessing
│   ├── download_detector.py         # Checksum-verified model provisioning
│   ├── Dockerfile                   # Recommended CPU production image
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── tests/                       # Auth, quota and API tests
├── frontend/
│   ├── src/context/AuthContext.jsx  # Supabase browser session
│   ├── src/pages/Login.jsx          # Google and email authentication UI
│   ├── src/components/RequireAuth.jsx
│   └── src/services/ocrService.js   # Bearer-token OCR API client
├── supabase/migrations/             # Profile, scan log and atomic quota RPCs
├── trocr-base-printed/              # Alternative int8 ONNX image
├── ocr/                             # Supporting capture/stitching utilities
└── README.md
```

## 1. Supabase setup

Create a Supabase project and apply the migration:

```text
supabase/migrations/20261113000000_auth_and_scan_quota.sql
```

You can paste the migration into **Supabase Dashboard → SQL Editor** and run it, or use the Supabase CLI migration workflow.

In **Authentication → Providers**:

- Enable Google and configure the Google OAuth client credentials.
- Enable Email provider.
- Keep email confirmation enabled. The backend verifies `email_confirmed_at` against Supabase Auth before allowing OCR.
- Enable CAPTCHA / bot protection for sign-up if it is available for your project.

In **Authentication → URL Configuration**, add the frontend URLs to the allowed redirect URLs, including:

```text
http://localhost:5173/recognize
https://YOUR_VERCEL_DOMAIN/recognize
```

For Google OAuth, use the callback URL displayed by Supabase in the Google Cloud OAuth client configuration. Do not substitute the frontend URL for Supabase's provider callback URL.

### Supabase secrets

Get these values from the Supabase project settings:

| Value | Where it is used | Secret? |
|---|---|---|
| Project URL | Frontend and backend | No |
| Publishable key (`sb_publishable_...`) | Frontend and backend Auth user check | Public browser key; protect data with RLS |
| Secret key (`sb_secret_...`) | Backend only, for quota RPC calls | **Yes — never expose it to Vite** |
| JWT signing secret | Backend only, legacy HS256 projects only | **Yes** |

New projects using asymmetric JWT signing keys are verified from the Supabase JWKS endpoint. If the project still uses legacy HS256 signing, configure `SUPABASE_JWT_SECRET` on the backend. Never put either secret in a `VITE_` variable.

## 2. Backend setup

Use Python 3.14 to match `backend/Dockerfile`.

Windows PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

macOS / Linux:

```bash
cd backend
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Fill the Supabase variables in `backend/.env`. At minimum, configure:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-project-key
SUPABASE_SECRET_KEY=sb_secret_your-backend-secret
SUPABASE_JWT_ISSUER=https://YOUR_PROJECT_REF.supabase.co/auth/v1
REQUIRE_VERIFIED_EMAIL=true
FREE_SCAN_LIMIT=5
GLOBAL_DAILY_SCAN_LIMIT=0
ALLOWED_ORIGINS=http://localhost:5173
```

Provision the model weights:

```bash
python download_detector.py
```

The DBNet downloader uses a public GitHub mirror of the OpenCV model and checks the expected SHA-1 before accepting the file. Override `DBNET_MODEL_URL` and `DBNET_MODEL_SHA1` when you move the artifact to an immutable release or your own model registry. TrOCR weights are cached under `backend/models/`.

Start the API from the `backend` directory:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Useful routes:

| Route | Auth required | Purpose |
|---|---:|---|
| `GET /health` | No | Public service/model readiness |
| `GET /api/me` | Yes | Current user and usage summary |
| `GET /api/me/usage` | Yes | Current scan allowance |
| `POST /ocr` | Yes | Reserve a scan and run OCR |

### Backend environment variables

| Variable | Default | Purpose |
|---|---|---|
| `SUPABASE_URL` | — | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | — | Used to ask Supabase Auth for the signed-in user record (legacy `SUPABASE_ANON_KEY` also accepted) |
| `SUPABASE_SECRET_KEY` | — | Backend-only PostgREST RPC credential (legacy `SUPABASE_SERVICE_ROLE_KEY` also accepted) |
| `SUPABASE_JWT_ISSUER` | `${SUPABASE_URL}/auth/v1` | Expected JWT issuer |
| `SUPABASE_JWT_AUDIENCE` | `authenticated` | Expected JWT audience |
| `SUPABASE_JWT_SECRET` | — | Legacy HS256 verification secret, only when applicable |
| `REQUIRE_VERIFIED_EMAIL` | `true` | Reject unconfirmed email accounts |
| `FREE_SCAN_LIMIT` | `5` | Lifetime free scan allowance per account |
| `GLOBAL_DAILY_SCAN_LIMIT` | `0` | Optional global daily cap; `0` disables it |
| `DBNET_MODEL_URL` | Public GitHub mirror | DBNet model artifact URL |
| `DBNET_MODEL_SHA1` | OpenCV model SHA-1 | Expected DBNet file checksum |
| `DBNET_MODEL_PATH` | `backend/models/DB_TD500_resnet50.onnx` | Detector file path |
| `TROCR_MODEL_ID` | `microsoft/trocr-small-stage1` | Hugging Face model ID or local path |
| `OCR_BACKEND` | `pytorch` | Recognition runtime (`pytorch` or `onnx`) |
| `TROCR_ONNX_DIR` | `models/trocr-onnx` | ONNX recognizer directory |
| `OCR_BATCH_SIZE` | `4` | TrOCR inference batch size |
| `MIN_CROP_STD` | `12.0` | Low-variance crop rejection threshold |
| `TORCH_NUM_THREADS` | `2` | CPU intra-op thread count |
| `MAX_UPLOAD_BYTES` | `15728640` | Maximum upload size (15 MiB) |
| `ALLOWED_ORIGINS` | Local Vite origins | Comma-separated CORS origins |

## 3. Frontend setup

Use Node.js `^20.19.0` or `>=22.12.0` for the current Vite toolchain.

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Set `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`VITE_SUPABASE_PUBLISHABLE_KEY` is a public client key by design (legacy projects may use `VITE_SUPABASE_ANON_KEY`). Database access is protected by RLS and the migration does not grant browser roles direct access to quota tables or quota-mutating RPC functions. The secret key is backend-only.

After adding the Supabase dependency, run `npm install` and commit the refreshed `package-lock.json` so clean installs remain reproducible. The frontend provides Google and email/password sign-in, protected workspace routing, a remaining-scan indicator, and a scan-limit state. `POST /ocr` is still authoritative: hiding or disabling a button in React is only a usability feature; the Postgres function enforces the actual allowance.

## 4. Scan quota semantics

The quota is reserved after upload-size and image-decode validation but before expensive OCR inference. The database transaction locks the user's profile row and increments the counter only when the allowance is not exhausted. This prevents two parallel requests from spending the same final scan.

- Invalid/empty uploads do not consume a scan.
- A valid request that reaches OCR consumes one scan, including a valid image with no detected text.
- An inference exception attempts to refund the reservation.
- The log stores user ID, timestamp, status and character count. It does not store the uploaded image or extracted text.
- The default is a lifetime allowance. There is no periodic reset.
- `profiles.scan_limit` can be set explicitly later for a custom plan; a `NULL` value uses `FREE_SCAN_LIMIT`.

The global daily cap is an optional operational circuit breaker, not a user plan. Keep it disabled initially unless you need a hard ceiling on service-wide inference volume.

## 5. CI/CD

`.github/workflows/backend.yml` runs when backend/model/migration workflow paths change:

1. Installs lightweight test dependencies.
2. Runs Ruff and the FastAPI/JWT/quota tests.
3. Builds the production `backend/Dockerfile` image with BuildKit cache.
4. Starts the container with the real model weights and waits for `GET /health` to report `model_loaded: true`.

Dependabot is configured for weekly Python, Docker base-image and GitHub Actions update PRs. Merge dependency PRs only after the CI checks pass.

The migration SQL is exercised against an isolated PostgreSQL service in CI; CI does **not** apply migrations to your live Supabase project. Apply reviewed Supabase migrations to production deliberately before deploying backend code that depends on them.

### Azure Container Apps + Docker Hub deployment

For the full one-time Azure OIDC, Docker Hub token, Container App configuration, and rollback procedure, see [`AZURE_DEPLOYMENT.md`](AZURE_DEPLOYMENT.md).


The production backend is built from **`backend/Dockerfile`** and deployed to the existing Azure Container App. The GitHub Actions workflow publishes the same image to Docker Hub under two tags:

- `docker.io/dinokiller0607/ecriture-ai:latest` — convenient moving tag.
- `docker.io/dinokiller0607/ecriture-ai:<full-git-commit-sha>` — immutable deployment tag used by Azure.

Azure is updated to the unique commit-SHA tag, not the moving `latest` tag, so each deployment is traceable and can be rolled back to a known image. Pull requests run tests and a real-model Docker startup smoke test but do not publish or deploy. A push to `main` or `master` runs CI, publishes the Docker image, then updates the existing Azure Container App. Frontend changes are independent and continue to deploy through Vercel.

#### GitHub Actions configuration

In the GitHub repository, open **Settings → Secrets and variables → Actions** and create these repository secrets:

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username (`dinokiller0607`) |
| `DOCKERHUB_TOKEN` | A Docker Hub access token with read/write access to `dinokiller0607/ecriture-ai` |
| `AZURE_CLIENT_ID` | Microsoft Entra application/service-principal client ID used for GitHub OIDC |
| `AZURE_TENANT_ID` | Microsoft Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID containing the Container App |

Create these repository **variables** (not secrets):

| Variable | Value |
|---|---|
| `AZURE_RESOURCE_GROUP` | Resource group containing the existing Container App |
| `AZURE_CONTAINER_APP_NAME` | Exact name of the existing Azure Container App |

The workflow uses OpenID Connect (OIDC) for Azure authentication; it does not require a long-lived `AZURE_CREDENTIALS` JSON secret. Configure a Microsoft Entra federated credential to trust this GitHub repository and the production branch (`refs/heads/main`, or `refs/heads/master` if that is your production branch). Grant the service principal **Contributor** on the resource group containing the Container App, or a narrower custom role with the required Container Apps update and revision/traffic permissions. Keep the trust subject restricted to the intended repository and branch.

The workflow assumes your Docker Hub repository is `dinokiller0607/ecriture-ai`. If your GitHub production branch is `master`, the workflow supports it; otherwise `main` is supported. Only pushes to either production branch deploy. Manual workflow runs and pull requests only validate.

#### Azure Container App prerequisites

1. The existing Container App must already exist in the specified resource group.
2. Its container must listen on port `8000`; the Dockerfile exposes this port and starts Uvicorn on `${PORT:-8000}`.
3. The app should have external HTTP ingress if you want the post-deployment public `/health` check to run from GitHub Actions.
4. For the safest startup behavior with large OCR models, configure HTTP startup and readiness probes on port `8000`, path `/health`. Allow sufficient startup time for the DBNet and TrOCR weights to load. The endpoint reports `model_loaded: true` only after the model is initialized.
5. If the Docker Hub repository is **private**, configure Docker Hub registry credentials on the Container App once (prefer a read-only Docker Hub access token). A public repository does not need registry credentials. Do not put container-pull credentials in the Docker image.

On every successful production push, the workflow:

1. Runs Ruff and unit/API/PostgreSQL quota tests.
2. Builds `backend/Dockerfile`, starts the image with the real OCR models, and waits for `/health` to report `model_loaded: true`.
3. Pushes `latest` and the full Git commit SHA to Docker Hub.
4. Authenticates to Azure with GitHub OIDC and updates the existing Container App to the immutable SHA image.
5. In multiple-revision mode, routes 100% of traffic to the latest revision. This is a full production cutover, not a canary rollout.
6. Checks the Container App's public `/health` endpoint for up to 15 minutes.

Azure Container Apps creates a new revision for image changes. In single-revision mode, the previous revision continues serving until the new revision is ready; in multiple-revision mode, traffic weights determine which revision serves users. See the [Azure Container Apps revision documentation](https://learn.microsoft.com/en-us/azure/container-apps/revisions) and [GitHub OIDC in Azure](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure).

If a deployment fails after the image is pushed, the SHA-tagged image remains in Docker Hub and can be redeployed by selecting that tag in Azure or re-running the workflow from the corresponding commit.

### Vercel frontend deployment

Set the Vercel project root to `frontend` and configure:

- `VITE_API_URL` = public Azure Container Apps API origin (for example, `https://YOUR-CONTAINER-APP.<region>.azurecontainerapps.io`)
- `VITE_SUPABASE_URL` = Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` = Supabase publishable key (legacy projects may use `VITE_SUPABASE_ANON_KEY`)

Add the Vercel website origin to backend `ALLOWED_ORIGINS` in the Azure Container App's environment settings and to Supabase Auth's allowed redirect URLs. Redeploy the frontend after changing Vite environment variables. Set all Supabase backend credentials as Azure Container App secrets/environment variables; never bake them into the Docker image or commit them to Git.

## 6. API examples

`GET /health` is public:

```bash
curl https://YOUR_API/health
```

Protected usage endpoint:

```bash
curl https://YOUR_API/api/me/usage \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

OCR request:

```bash
curl -X POST https://YOUR_API/ocr \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -F "file=@sample_page.jpg"
```

A successful response includes `text`, `characters` and the updated `usage` object. An exhausted account receives HTTP `429` with `detail.code = "quota_exceeded"`. A global circuit-breaker response has `detail.code = "daily_limit_reached"`.

## 7. Local tests

Backend unit/API tests use the lightweight test dependency set and mock the external Supabase RPC and OCR inference calls:

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
ruff check .
```

The GitHub Actions Docker smoke job builds the real OCR image and verifies model startup. It does not yet enforce a Character Error Rate (CER) threshold: that should be added only after a small, versioned set of sample images has reviewed ground-truth transcripts. A model-quality gate without trusted labels would create false confidence.

## Security notes

- Remove old `VITE_API_KEY` and backend `API_KEY` settings from Vercel and Azure Container Apps after migrating. This implementation no longer reads or sends `X-API-Key`.
- Keep `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) and legacy `SUPABASE_JWT_SECRET` only in the backend's runtime secret store.
- Keep email confirmation and Supabase sign-up CAPTCHA/bot protection enabled.
- Account quotas deter casual abuse but are not an absolute Sybil-proof system. A user can create multiple verified accounts. Use a hosting/WAF rate limit on signup/API traffic and monitor the global cap if account farming becomes a problem.
- Do not normalize Gmail dots or `+tags` into one identity. That is provider-specific and can incorrectly merge distinct addresses; verified identity plus rate limits is safer.
- `/health` intentionally exposes only service/model readiness and is public for Azure Container Apps probes and frontend monitoring.
