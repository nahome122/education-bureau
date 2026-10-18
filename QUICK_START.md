# Quick Start

## Prerequisites

- Node.js and npm
- MySQL (XAMPP is supported for local development)

## First-time setup

1. Start MySQL.
2. Copy `backend/.env.example` to `backend/.env` and set local database values.
3. Install and set up the backend:

   ```powershell
   cd backend
   npm install
   npm run db:setup
   npm run db:migrate-teacher-scores
   npm run db:migrate-school-management
   npm run db:migrate-transfer-history-clear
   npm run db:migrate-attendance-school
   npm run db:remove-audit-logs
   ```

   Review and back up the target database before running the school-management
   and attendance migrations. They are intentionally not run by the
   application. The attendance migration adds school attribution to existing
   attendance rows and backfills from each employee's current school assignment
   where available; previous school assignments cannot be inferred from the
   old schema.
   The audit-log removal migration permanently deletes the audit_logs table
   and its stored entries from an existing database. Back up the database
   before running it.
4. In a second terminal, install and start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

5. In the backend terminal, start the API:

   ```powershell
   npm run dev
   ```

Open `http://localhost:5173`. Vite proxies `/api` to
`http://localhost:5000` by default. Set `VITE_PROXY_TARGET` in the frontend
environment to override the local proxy target, or set `VITE_API_URL` to use a
direct API URL.

See [README.md](./README.md) for deployment and environment-variable guidance.
