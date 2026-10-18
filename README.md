# Teacher & Staff Management System

**Wachale Woreda Education Bureau** — Secure web-based Teacher & Staff Management System.

---

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 19, Vite, React Router v7, Chart.js, React Hot Toast |
| Backend  | Node.js, Express 4, MySQL 8, JWT, bcrypt |
| Auth     | JWT (8h expiry) + bcrypt (rounds: 12) |
| Security | Helmet, CORS, Rate Limiting, Input Validation, XSS Protection |

---

## Quick Start

### 1. Start MySQL and set up the database

On Windows, open the XAMPP Control Panel at `C:\xampp\xampp-control.exe` and
click **Start** next to **MySQL**. Wait until it shows as running. If MySQL
does not start, check whether another database service is already using port
3306.

Copy `backend/.env.example` to `backend/.env` and set your local MySQL
credentials. The default XAMPP settings are `localhost:3306`, user `root`, an
empty password, and database `tsms_db`. From the backend directory, create the
schema and seed data:

```powershell
cd backend
npm install
npm run db:setup
```

Teacher records store semester scores. For an existing database, run
`npm run db:migrate-teacher-scores` from `backend/` after reviewing and backing
up the database; fresh databases created from the current schema already
contain these columns. The migration is safe to rerun.

If you changed the MySQL username or password, update `backend/.env` first.
After reviewing the migration for your target database, run
`npm run db:migrate-school-management` from `backend/`. This adds manager
assignment and school-report tables and backfills existing school
manager assignments. The application does not run this migration automatically.
To remove the retired administrative audit table and its stored entries from
an existing database, run `npm run db:remove-audit-logs` from `backend/` after
reviewing and backing up the target database. This operation is destructive
and is not run automatically.
To remove the retired Viewer role from an existing database, run
`npm run db:migrate-remove-viewer` from `backend/`. This deactivates existing
Viewer accounts without deleting accounts or role records; it is not run
automatically.
To enable the employee Transfer Request page's Clear history action, run
`npm run db:migrate-transfer-history-clear` from `backend/` after reviewing
and backing up the target database. This hides existing requests only from
the employee's personal history; Administrator transfer records are retained.
The migration creates a marker table and does not modify transfer records.
To enable the Administrator's All Schools Attendance reports, review and back
up the database, then run `npm run db:migrate-attendance-school` from
`backend/`. This adds a nullable school reference to attendance records and
backfills existing rows from employees' current school assignments where
possible; the previous schema did not preserve historical school assignments.
The migration is not run automatically. Attendance percentages use
`(Present + Late) / (Present + Late + Absent)`; recorded On Leave, Holiday, and
unrecorded teachers are excluded. Missing records are reported separately and
are not counted as absences. The current schema does not track leave approval
separately from the On Leave attendance status, nor does it store a separate
school attendance submission event. Record coverage is therefore inferred from
teacher attendance rows on the selected end date.
The Administrator report endpoint is role-restricted. Existing School Manager
attendance read and marking requests continue to require an active assignment
and are scoped to that school's teacher roster by the backend.

### 2. Start the Backend

```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:5000
```

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## Deployment

### Frontend on Vercel

- Set the project root directory to `frontend`.
- Use `npm install` as the install command, `npm run build` as the build
  command, and `dist` as the output directory.
- Set `VITE_API_URL` to the deployed backend origin followed by `/api`, for
  example `https://your-api.example.com/api`.

### Backend on Railway or Render

- Set the service root directory to `backend`, with `npm install` as the
  install command and `npm start` as the start command.
- Configure the database and JWT environment variables from
  `backend/.env.example` in the hosting provider's environment settings. Do not
  upload `.env` files or commit real credentials.
- Set `CLIENT_URL` to the Vercel frontend origin. Multiple allowed origins can
  be comma-separated.
- Provide `DATABASE_URL` if the provider supplies a MySQL URL, or set the
  individual `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`
  variables.
- Configure `REPORT_UPLOAD_DIR` to a persistent private disk directory for
  report attachments. On Render, attach a persistent disk and use its mount
  path; on Railway, use a persistent volume. Do not use a public/static folder.


---

## Default Login Credentials

> **Administrator** uses `Employee@123` — Other users use `password` — Change them immediately after first login.

| Role | Username | Password |
|------|----------|----------|
| Administrator | `belete.guta` | `Employee@123` |
| School Manager | `schoolmanager` | `password` |
| Attendance Officer | `attendanceofficer` | `password` |

---

## Administrator Info

- **Name:** Nahom Eshetu
- **Username:** nahom.eshetu
- **Password:** nahom@123
- **Email:** nahom@tsms.gov.et

---

## Role Permissions

| Feature | Administrator | School Manager | Att. Officer |
|---------|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ |
| User Management | ✅ | ❌ | ❌ |
| Schools | ✅ | ❌ | ❌ |
| Teachers | ✅ | ✅ | ✅ (view) |
| Staff | ✅ | ✅ | ❌ |
| Attendance | ✅ | ✅ | ✅ |
| Departments | ✅ | ❌ | ❌ |
| Positions | ✅ | ❌ | ❌ |
| Reports | ✅ | ✅ | ✅ |
| System Logs | ✅ | ❌ | ❌ |
| System Settings | ✅ | ❌ | ❌ |
| Profile / Change Password | ✅ | ✅ | ✅ |

---

## Database Schema

Core tables: `roles`, `schools`, `departments`, `positions`, `users`, `teachers`,
`staff`, `attendance`, and `login_logs`.

The school-management migration adds `school_manager_assignments`,
`school_reports`, and `school_report_events`. The retired `audit_logs` table can
be removed from existing databases with `npm run db:remove-audit-logs`; this
permanently deletes its stored entries. Report attachment files are stored
outside the public web root, are limited to PDF/PNG/JPEG up to 10 MB, and require
an authenticated, authorized request to download.

Administrators can clear login and report-review history for an individual
teacher, staff member, or system user; School Managers can clear login history
only for employees in their assigned school. Attendance and submitted report
content are retained.

---

## Environment Variables

### backend/.env

Copy `backend/.env.example` to `backend/.env`; set a unique, strong JWT secret
and the correct database credentials there. The example file contains safe
placeholders.

### frontend/.env

Copy `frontend/.env.example` to `frontend/.env` only if you need to override the
default API URL:

```env
VITE_API_URL=http://localhost:5000/api
```

For Vercel, configure `VITE_API_URL` in the project settings instead of
committing a production `.env` file.

---

## Security Features

- ✅ JWT Authentication (protected routes)
- ✅ bcrypt password hashing (rounds: 12)
- ✅ Role-Based Access Control (RBAC)
- ✅ 403 Access Denied page for unauthorized access
- ✅ Login attempt logging (IP, user agent, status)
- ✅ Rate limiting (login: 20/15min, API: 300/15min)
- ✅ CORS configured
- ✅ Input validation (express-validator)
- ✅ SQL parameterized queries (no injection)
- ✅ No public registration — Admin creates all accounts
