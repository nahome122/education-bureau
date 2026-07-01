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

### 1. Set up MySQL Database

Make sure MySQL is running, then run the setup script:

```bash
# Edit DB credentials first
notepad server/.env

# Then run schema + seed
node server/src/scripts/setupDb.js
```

### 2. Start the Backend

```bash
cd server
npm install
npm run dev
# Runs on http://localhost:5000
```

### 3. Start the Frontend

```bash
cd client
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## Default Login Credentials

> **All passwords are `password`** — Change them immediately after first login.

| Role | Username | Password |
|------|----------|----------|
| Administrator | `admin` | `password` |
| School Manager | `schoolmanager` | `password` |
| Attendance Officer | `attendanceofficer` | `password` |
| Viewer | `viewer` | `password` |

---

## Role Permissions

| Feature | Administrator | School Manager | Att. Officer | Viewer |
|---------|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| User Management | ✅ | ❌ | ❌ | ❌ |
| Schools | ✅ | ❌ | ❌ | ❌ |
| Teachers | ✅ | ✅ | ✅ (view) | ❌ |
| Staff | ✅ | ✅ | ❌ | ❌ |
| Attendance | ✅ | ✅ | ✅ | ❌ |
| Departments | ✅ | ❌ | ❌ | ❌ |
| Positions | ✅ | ❌ | ❌ | ❌ |
| Reports | ✅ | ✅ | ✅ | ✅ |
| System Logs | ✅ | ❌ | ❌ | ❌ |
| System Settings | ✅ | ❌ | ❌ | ❌ |
| Profile / Change Password | ✅ | ✅ | ✅ | ✅ |

---

## Database Schema

Tables: `roles`, `schools`, `departments`, `positions`, `users`, `teachers`, `staff`, `attendance`, `login_logs`

---

## Environment Variables

### server/.env

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=tsms_db
JWT_SECRET=change_this_in_production
JWT_EXPIRES_IN=8h
CLIENT_URL=http://localhost:5173
```

### client/.env

```env
VITE_API_URL=http://localhost:5000/api
```

---

## Security Features

- ✅ JWT Authentication (protected routes)
- ✅ bcrypt password hashing (rounds: 12)
- ✅ Role-Based Access Control (RBAC)
- ✅ 403 Access Denied page for unauthorized access
- ✅ Login attempt logging (IP, user agent, status)
- ✅ Rate limiting (login: 20/15min, API: 300/15min)
- ✅ Helmet security headers
- ✅ CORS configured
- ✅ Input validation (express-validator)
- ✅ SQL parameterized queries (no injection)
- ✅ No public registration — Admin creates all accounts
