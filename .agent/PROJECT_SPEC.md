# PROJECT_SPEC.md

## Project Overview

MamnonThanhVy is a kindergarten/school management web application.

Primary users:
- Admin users manage school data, teachers, classes, students, attendance, fees, policies, and reports.
- Teacher users can access teacher-specific workflows such as leave requests and attendance-related views.

The application is split into:
- `frontend/`: Vue 3 single-page app.
- `backend/`: Node.js Express API.
- `scripts/`: SQL/deployment helper scripts.

## Tech Stack

Frontend:
- Vue 3
- Vite
- Vue Router
- Vuex
- Axios
- Bootstrap 5
- Tailwind CSS
- Sass
- Argon Dashboard UI assets/components

Backend:
- Node.js 18+
- Express
- PostgreSQL via `pg`
- JWT auth via `jsonwebtoken`
- Password hashing via `bcryptjs`
- File upload via `multer`
- Excel import via `xlsx`
- Environment config via `dotenv`

Deployment:
- GitHub Actions workflow in `.github/workflows/ci-cd.yml`
- Ubuntu server
- nginx
- systemd service named `mamnon-backend`
- App path on server: `/var/www/mamnonThanhVy`

## Local Commands

Frontend:
- Install: `cd frontend && npm install`
- Dev server: `cd frontend && npm run dev`
- Build: `cd frontend && npm run build`
- Preview: `cd frontend && npm run preview`

Backend:
- Install: `cd backend && npm install`
- Start: `cd backend && npm start`
- Dev watch: `cd backend && npm run dev`
- Create DB/init schema: `cd backend && npm run db:create`
- Seed DB: `cd backend && npm run db:seed`

Windows helpers:
- `run-web.cmd` starts the frontend dev server.
- `run-api.cmd` starts the backend API.

## Runtime Configuration

Frontend:
- API base URL comes from `VITE_API_BASE`.
- If unset, frontend uses `/api`.
- Vite proxies `/api` and `/uploads` to `http://localhost:3000`.

Backend:
- Default API port is `3000`.
- Database config is loaded from `backend/.env`.
- Prefer `DATABASE_URL` with a non-empty password or individual `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`.
- `JWT_SECRET` is required in production.
- `JWT_EXPIRES_IN` defaults to `7d`.

## Folder Structure

Important frontend paths:
- `frontend/src/main.js`: app bootstrap.
- `frontend/src/App.vue`: root app shell.
- `frontend/src/router/index.js`: routes and auth guards.
- `frontend/src/store/index.js`: Vuex UI/auth state.
- `frontend/src/api/client.js`: Axios instance and auth interceptor.
- `frontend/src/views/`: feature pages.
- `frontend/src/components/`: reusable app components.
- `frontend/src/examples/`: Argon Dashboard example/layout components.
- `frontend/src/assets/`: images, fonts, styles, dashboard assets.
- `frontend/src/data/vnAdministrativeUnits.json`: Vietnam administrative data.

Important backend paths:
- `backend/src/index.js`: Express app, middleware, route mounting, error handler.
- `backend/src/db.js`: PostgreSQL pool, schema initialization, row mappers, normalizers.
- `backend/src/middleware/auth.js`: JWT auth and role guards.
- `backend/src/routes/`: API route modules.
- `backend/src/seed.js`: seed data.
- `backend/src/create-db.js`: database creation helper.
- `backend/src/import-students-from-excel.js`: student import helper.
- `backend/uploads/`: runtime upload directory, served as `/uploads`.

## Main Features

Authentication:
- Register, login, and current-user lookup.
- JWT bearer tokens stored by frontend in localStorage under `school_token`.
- User object stored in localStorage under `school_user`.

School management:
- Dashboard metrics.
- Students CRUD and student detail.
- Teachers CRUD and teacher roles.
- Classes CRUD.
- Class-teacher assignments.
- Student class history.

Attendance:
- Student attendance by class/date/session.
- Student monthly summaries.
- Teacher attendance and leave-related records.
- Teacher leave request flow.
- Manager/admin leave calendar.

Fees:
- Fee item templates.
- Fee periods.
- Discount policies.
- Service subscriptions and usage entries.
- Period generation.
- Student fee periods.
- Adjustments.
- Payments.
- Period reports.

Uploads:
- Authenticated avatar image upload.
- Backend serves uploaded files through `/uploads`.

## Frontend Routes

Routes are defined in `frontend/src/router/index.js`.

Public routes:
- `/signin`
- `/signup`

Authenticated routes:
- `/dashboard`
- `/school`
- `/students/create`
- `/students/:id/detail`
- `/attendance`
- `/profile`

Admin-only routes:
- `/leave-calendar`
- `/fee-items`
- `/fee-periods`
- `/fee-policies`
- `/fee-services`
- `/fee-collection`

Teacher-only route:
- `/teacher-leave`

Compatibility redirects:
- `/students` redirects to `/school`
- `/teachers` redirects to `/school`
- `/classes` redirects to `/school`

## API Conventions

Base API path:
- `/api`

Mounted route groups:
- `/api/health`
- `/api/auth`
- `/api/upload`
- `/api/dashboard`
- `/api/students`
- `/api/teachers`
- `/api/classes`
- `/api/attendance`
- `/api/fees`

Authentication:
- Protected endpoints require `Authorization: Bearer <token>`.
- Frontend attaches the bearer token in `frontend/src/api/client.js`.
- On `401`, frontend clears auth and redirects to `/signin`.

Response style:
- JSON responses.
- Errors generally use `{ "error": "message" }`.
- Avoid leaking internal server errors to clients.

## Role Model

Known roles:
- `admin`
- `teacher`
- `accountant`

Important rules:
- `requireAuth` validates JWT and sets `req.user`.
- `requireAdmin` only allows `admin`.
- `requireManager` is currently an alias for `requireAdmin` for backward compatibility.
- Teacher-only frontend routes require `role === "teacher"` and a non-null `teacherId`.

## Database Notes

Database is PostgreSQL.

Schema is initialized and migrated incrementally in `backend/src/db.js` using `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

Important tables include:
- `students`
- `teachers`
- `teacher_roles`
- `classes`
- `class_teachers`
- `student_class_history`
- `student_attendance`
- `teacher_attendance`
- `users`
- `fee_periods`
- `fee_item_templates`
- `fee_period_items`
- `discount_policies`
- `discount_policy_students`
- `student_fee_periods`
- `student_fee_period_items`
- `student_fee_period_discounts`
- `fee_payments`
- `student_service_subscriptions`
- `student_service_usage_entries`
- `fee_adjustments`

Coding expectations:
- Use parameterized queries.
- Keep row-to-API conversion in mapper helpers where possible.
- Keep date API values in `YYYY-MM-DD` format.
- Preserve existing camelCase API response fields and snake_case DB fields.
- Be careful with fee calculation logic; it affects invoices and payments.

## UI Conventions

The frontend uses Argon Dashboard style assets plus Bootstrap utility classes.

Follow existing patterns:
- Reuse app components from `frontend/src/components/`.
- Reuse Argon/example layout components where the app already uses them.
- Keep dashboard/admin screens dense, scannable, and operational.
- Include loading, empty, error, and disabled states for user-facing flows.
- Use existing table styles such as `frontend/src/assets/css/panel-tables.css` when working on panels.
- Prefer Vue 3 Composition API and `<script setup>` when matching nearby files.

## Coding Conventions

General:
- The project uses ES modules in both frontend and backend.
- Match existing JavaScript style in nearby files.
- Keep edits minimal and scoped to the task.
- Do not add dependencies unless clearly necessary.

Frontend:
- Use the shared Axios client from `frontend/src/api/client.js`.
- Use Vuex auth state from `frontend/src/store/index.js`.
- Keep route access rules in `frontend/src/router/index.js`.
- Prefer computed state instead of duplicated reactive state.
- Avoid direct DOM manipulation unless the surrounding code already requires it.

Backend:
- Mount new route groups from `backend/src/index.js`.
- Keep route handlers consistent with existing `async (req, res, next)` pattern.
- Pass errors to `next`.
- Validate inputs before database writes.
- Use auth/role middleware consistently.
- Do not expose stack traces or raw database errors to clients.

## Testing And Verification

There is no dedicated test script currently.

Use the smallest relevant check:
- Frontend UI/build changes: `cd frontend && npm run build`
- Backend syntax/runtime changes: `cd backend && npm start` or targeted startup check when feasible
- Database-affecting changes: inspect schema/init code and run only when a configured local database is available

If a check cannot be run because local environment variables or PostgreSQL are missing, state the blocker briefly.

## Deployment Notes

CI/CD:
- Workflow verifies backend install, frontend install, and frontend build on pushes to `main`.
- Deploy runs `scripts/deploy.sh`.

Server assumptions:
- Node.js 20
- nginx
- PostgreSQL
- systemd service `mamnon-backend`
- backend `.env` lives on the server at `backend/.env`

Deployment script behavior:
- Uses `git pull --ff-only origin main`
- Rebuilds frontend
- Restarts backend service
- Reloads nginx

## Do Not Change Without Explicit Instruction

- Do not weaken auth, role checks, CORS/auth behavior, or JWT production requirements.
- Do not change fee calculation/payment semantics casually.
- Do not rewrite `backend/src/db.js` schema initialization wholesale.
- Do not remove backward-compatible redirects or `requireManager` alias unless asked.
- Do not change deployment server details or scripts without confirming intent.
- Do not commit secrets, `.env`, database passwords, JWT secrets, or uploaded private data.
