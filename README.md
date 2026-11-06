# OSHAN MENDIS ICT

A bilingual React/Vite and Express/MongoDB learning platform for A/L ICT students. Student registration, admin management, batch enrollments, manual payment verification, protected PDF downloads, class schedules, announcements, and learning progress use the same MongoDB records.

## Local setup

Install Node.js 20 or newer and configure MongoDB Atlas or a local MongoDB instance.

### Backend

```powershell
cd server
npm install
Copy-Item .env.example .env
```

Set `MONGODB_URI` and a long random `JWT_ACCESS_SECRET` in `server/.env`. Keep `.env` private. Seed the initial 2026, 2027, and 2028 academic years and batches, and assign IDs to older student accounts:

```powershell
npm run seed:batches
```

Create the first administrator securely:

```powershell
$env:ADMIN_NAME="Administrator"
$env:ADMIN_EMAIL="your-admin@example.com"
$env:ADMIN_PASSWORD="Use-a-unique-long-password"
node scripts/createAdmin.js
Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
npm run dev
```

### Frontend

```powershell
cd client
npm install
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). Students register from **Student Login**. Admins sign in at `/admin/login`.

## Student enrollment and resource access

Public registration creates only a student role, a generated student ID, a profile, and an unpaid enrollment for an open batch. New students can sign in before payment. Admins record payments as pending and verify them from **Payments**. Verification is attached to one student enrollment and batch. Access is checked server side on every resource, PDF download, and Zoom-link request using account status, enrollment dates/status, and a confirmed payment. A later published resource for the same batch is included automatically. Rejection, refund, suspension, revocation, or expiration removes access through those checks.

The admin can add academic years and batches from **My Classes**. Resource records belong to one or more batches. Students only see locked titles for their own enrollment and do not receive protected file or Zoom URLs until authorized. Protected PDFs uploaded in the admin interface are stored under `STORAGE_DIR` and streamed through an authenticated download endpoint. Configure this directory as a persistent mounted disk on the backend host; the default local directory is suitable for development. Upload limit is 25 MB per PDF.

## Run and deployment configuration

- Frontend: configure `VITE_API_BASE_URL` as a Netlify build environment variable before building (include `/api`, for example `https://api.example.com/api`), then deploy `client/dist`. This value is embedded at build time. Without it, the production app falls back to the frontend origin and API requests go to Netlify instead of the Express server, causing the payment upload Network Error.
- Backend: deploy `server` to a Node.js host. Configure `MONGODB_URI`, `JWT_ACCESS_SECRET`, `CLIENT_ORIGINS`, `NODE_ENV=production`, and `STORAGE_DIR`. Attach a persistent disk at `STORAGE_DIR` for uploaded PDFs. The health check is `GET /api/health`.
- `CLIENT_ORIGINS` is a comma-separated list of allowed frontend origins, such as `https://your-site.netlify.app`; surrounding spaces and a trailing slash are ignored. It must include the deployed frontend origin so browser requests pass CORS. Authentication uses an HTTP-only cookie and a bearer token for API requests.
- `.env` files and uploaded files are ignored by Git. Only `.env.example` belongs in the repository.

## Verification

```powershell
cd client
npm run build
npm run lint
cd ../server
node --check src/routes/authRoutes.js
node --check src/routes/contentRoutes.js
node --check src/routes/studentRoutes.js
```

The registration and payment-to-resource workflow should also be checked with a student test account: register, confirm pending/locked content, record and confirm a payment for one batch, verify that newly published resources unlock only for that batch, then refund or revoke access and confirm that protected endpoints deny access.

## Notes on external services

Payment verification is manual; no payment gateway is connected. Zoom meeting URLs and video hosting are configured by the administrator. Uploaded PDFs use the configured persistent backend disk. Video providers that issue permanent public URLs may still allow a previously authorized student to keep or share that URL; use private video hosting with expiring playback tokens if revocation must invalidate already delivered playback links. Email delivery and Zoom OAuth are not configured.
