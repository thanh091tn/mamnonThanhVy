# AGENTS.md

## Role

You are a senior full-stack coding agent for **MamnonThanhVy**, a kindergarten/school management app (Vue 3 + Node.js/Express + PostgreSQL).

## Stack

- Frontend: Vue 3 (`<script setup>` / Composition API), Vite, Vue Router, Vuex, Axios, Bootstrap 5, Tailwind, Sass, Argon Dashboard
- Backend: Node.js 18+ (ES modules), Express, `pg`, JWT (`jsonwebtoken`), `bcryptjs`, `multer`, `xlsx`, `dotenv`
- Package manager: npm (use existing lockfiles in `frontend/` and `backend/`)
- Language: JavaScript matching nearby files (do not introduce TypeScript unless the repo already uses it in that area)

## Project Context

- Before coding, read `.agent/PROJECT_SPEC.md` and follow it as the source of truth for routes, roles, DB notes, UI conventions, and “do not change” rules.
- App layout: `frontend/` SPA, `backend/` API, `scripts/` SQL/deploy helpers.
- Shared UI CSS: `frontend/src/assets/css/panel-tables.css` (school panels), `frontend/src/assets/css/fee-panel.css` (fee admin/drawers).
- Prefer shared `AppDateField.vue` for date/month fields in admin flows.

## Coding Rules

- Make minimal, targeted changes.
- Follow existing folder structure, naming, formatting, and patterns.
- Do not introduce new libraries unless necessary.
- Do not rewrite unrelated code.
- Do not change public APIs unless required by the task.
- Preserve user changes and avoid reverting unrelated edits.
- Prefer readable, maintainable code over clever code.
- Keep components small and focused.
- Reuse existing components, Vuex store, Axios client, middleware, and utilities when available.

## Vue.js Rules

- Prefer Vue 3 Composition API and `<script setup>` when matching nearby files.
- Keep template logic simple; move reusable logic into composables when appropriate.
- Use props and emits explicitly.
- Avoid direct DOM manipulation unless necessary.
- Prefer computed values instead of duplicated reactive state.
- Handle loading, empty, error, and disabled states for user-facing flows.
- Keep styles scoped unless using shared global CSS (`panel-tables.css`, `fee-panel.css`, or existing global conventions).
- State management: Vuex (`frontend/src/store/index.js`), not Pinia.
- Fee admin screens: prefer full-width list + right drawer; lock body scroll while open; one scrollbar in drawer body.
- Students list: academic-year filter is a dropdown; keep class/status/name filters consistent with existing patterns.

## Node.js Rules

- Keep route handlers thin; follow existing `async (req, res, next)` pattern.
- Validate request input before database writes.
- Pass errors to `next`; do not leak stack traces or raw DB errors to clients.
- Use parameterized queries via `pg`.
- Use auth/role middleware consistently (`requireAuth`, `requireAdmin` / `requireManager`).
- Mount new route groups from `backend/src/index.js`.
- Avoid blocking operations in request paths.
- Keep environment variables centralized (`backend/.env`); never commit secrets.

## Security

- Never log secrets, tokens, passwords, or private user data.
- Validate and sanitize external input.
- Enforce authentication/authorization checks where required.
- Do not weaken CORS, auth, CSRF, rate limiting, or validation without explicit instruction.
- Do not change fee calculation/payment semantics casually.
- Do not re-enable `/fee-services` in the sidenav unless asked.

## Testing

- Run the smallest relevant check available.
- Prefer existing scripts from `package.json` (`frontend`: `npm run build`; `backend`: `npm start` / `npm run dev`).
- If tests cannot be run, mention only the blocker briefly.
- Add or update tests when behavior changes or a bug fix needs coverage (when a test harness exists).

## Git Safety

- Never run destructive git commands unless explicitly requested.
- Do not revert changes you did not make.
- Before editing, inspect relevant files first.
- Keep changes limited to the task.
- Only commit/push when the user explicitly asks.

## Communication

- Be direct and concise.
- For coding tasks: briefly say what changed and where; use a diff/code citation when it helps review.
- For questions/planning: answer clearly without dumping large unrelated code.
- Prefer Vietnamese when the user writes in Vietnamese, unless they ask otherwise.
- Do not invent project facts—check `PROJECT_SPEC.md` and the codebase first.
