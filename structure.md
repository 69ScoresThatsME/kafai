# Kafai Frontend Structure

This repository is the browser frontend for Kafai, a personal electricity usage tracker. It is a Next.js 16 App Router application using React 19, TypeScript, Tailwind CSS v4, and `lucide-react`.

The frontend has no database access and no Next.js API routes. All persistence goes through the separate `kafai-api` repository. Read the workspace guide at `../structure.md` for the cross-repository architecture.

## File map

```text
kafai/
├── app/
│   ├── page.tsx              # Authenticated usage schedule and CRUD screen
│   ├── login/page.tsx        # Login screen
│   ├── register/page.tsx     # Account creation screen
│   ├── statist/page.tsx      # Authenticated statistics screen
│   ├── libs/api.ts           # API base URL, types, fetch wrappers, token handling
│   ├── layout.tsx            # Root HTML layout, Geist fonts, metadata
│   └── globals.css           # Tailwind import and shared visual utility classes
├── public/                   # Static public assets
├── iwant.jpg                 # Project image asset used by the repository as needed
├── next.config.ts            # Next configuration; currently default options
├── eslint.config.mjs         # ESLint configuration
├── postcss.config.mjs        # Tailwind/PostCSS configuration
├── tsconfig.json             # Strict TypeScript and @/* path alias
├── package.json              # Scripts and dependencies
├── AGENTS.md                 # Generated Next.js instructions
└── structure.md              # This guide
```

## Routes and responsibilities

| Browser route | File | Behavior |
|---|---|---|
| `/` | `app/page.tsx` | Requires a token, loads the user's records, adds/edits/deletes records, and renders calendar/table/list views. |
| `/login` | `app/login/page.tsx` | Sends username/password to `loginApi`; successful login stores the JWT through `api.ts` and navigates to `/`. |
| `/register` | `app/register/page.tsx` | Checks password confirmation locally, calls `registerApi`, then navigates to `/login` after success. |
| `/statist` | `app/statist/page.tsx` | Requires a token, loads all records, calculates usage/cost summaries in the browser, and links back to `/`. |

All four page files are client components. `layout.tsx` is the server root layout and supplies the global CSS and Geist font variables.

## API client contract

`app/libs/api.ts` is the only frontend module that should normally call the backend. It exports:

- `API_BASE_URL`: `NEXT_PUBLIC_API_URL`, trimmed of surrounding quotes and a trailing slash, or `https://kafai-api.vercel.app/api` when unset.
- `AuthResponse`: optional `message`, `token`, `expiresIn`, `userId`, and `error` fields.
- `KafaiRecord`: `_id`, `userId`, `recordedAt`, `targetDate`, `unit`, and optional timestamps.
- `loginApi(username, password)` and `registerApi(username, password)`.
- `getKafaiListApi()`, `addKafaiApi(payload)`, `updateKafaiApi(id, payload)`, and `deleteKafaiApi(id)`.

The authenticated wrappers read `localStorage.token`. If it is absent they return `{ error, status: 401 }` without making a request. Non-2xx JSON responses become the wrapper's `error` and `status`; network failures become a readable connection error containing the API URL.

The delete wrapper returns `{ success: true }` after any successful 2xx response and does not expose the backend's message to the page.

## Authentication behavior

1. `/login` calls `POST /auth/login` through `loginApi`.
2. On success, `loginApi` stores `data.token` in `localStorage` under `token`.
3. The login page navigates to `/`.
4. `/` and `/statist` check for `localStorage.token` after mounting. Without one, they navigate to `/login`.
5. Every protected API call sends `Authorization: Bearer <token>`.
6. If a protected request returns 401, the page removes the token and navigates to `/login`.
7. Logout only removes the browser token and navigates to `/login`; there is no server-side logout or token revocation endpoint.

The token is a browser-local JWT with a backend-declared lifetime of 30 days. It is not an HTTP-only cookie.

## Schedule page behavior

`app/page.tsx` owns all schedule-page state:

- `records`: the complete list returned by `GET /kafai`.
- `viewMode`: `calendar`, `table`, or `card`; default is `calendar`.
- `currentYear` and `currentMonth`: selected calendar month; default to the browser's current month.
- Add form: `recordedAt`, `targetDate`, and `unit`; date defaults use `new Date().toISOString().split("T")[0]`.
- Edit modal: copies the selected record's three editable values and sends them with `PUT`.
- `ratePerUnit`: default `4`; loaded from and saved to `localStorage.ratePerUnit`.

After add, update, or delete, the page calls `fetchRecords()` again so the UI reflects backend state. Add and edit validate that `unit` is present and numeric in the browser. The backend remains the final validator and owner of persistence.

Calendar and table/list filtering use `targetDate` first and fall back to `recordedAt` if needed. Calendar cells group records by `YYYY-MM-DD`; if multiple records share a target date, the cell displays their combined kWh and cost but its quick edit button opens only the first record. Table and list views show every record in the selected month.

## Frontend calculations

The rate is a local display multiplier:

```text
record cost = unit × ratePerUnit
month units = sum(unit for records whose targetDate is in selected YYYY-MM)
month cost = month units × ratePerUnit
overall units = sum(unit for all loaded records)
overall cost = overall units × ratePerUnit
```

The statistics page additionally computes:

- record count;
- monthly kWh and monthly cost, sorted newest month first;
- average monthly kWh and cost across active months;
- estimated annual kWh and cost by multiplying the active-month average by 12;
- the highest and lowest single-record `unit` values;
- the highest-usage month;
- a progress bar where each month is compared with the highest month.

Statistics groups records by the local browser date from `new Date(targetDate || recordedAt)`. Schedule filtering uses the ISO string prefix. Keep this difference in mind when changing date handling or supporting time zones.

## Styling and UI conventions

Most page styling is inline Tailwind utility classes. Shared custom classes are in `app/globals.css`:

- `.persona-bg`: animated pink diagonal background with reduced-motion support;
- `.persona-title-shadow`: black title with pink offset shadow;
- `.persona-card-wrapper`, `.persona-card`: constrained framed form layout;
- `.persona-banner`, `.persona-badge`: shared labels and banners;
- `.persona-input`, `.persona-btn`: shared form controls;
- `.persona-deco-left`, `.persona-deco-right`: decorative shapes.

The visual language uses heavy black borders, pink `#e60067`, yellow `#ffe600`, white cards, and hard offset shadows. Preserve these patterns when adding UI unless the requested feature needs a deliberate redesign.

## Local development

From this directory:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. To use a local API on another port, create a local `.env.local` with a browser-visible value such as:

```text
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

`NEXT_PUBLIC_API_URL` is embedded into the client bundle, so it must not contain secrets.

Available scripts:

```bash
npm run dev     # Next development server
npm run build   # Production build
npm run start   # Serve a prior production build
npm run lint    # ESLint
```

## Change guide for agents

- Change a page layout or interaction in its route's `page.tsx`.
- Change request shape, token attachment, response handling, or shared record typing in `app/libs/api.ts`.
- Change global fonts/metadata in `app/layout.tsx`.
- Change shared visual classes or global CSS in `app/globals.css`.
- For an API contract change, update this guide, the backend guide, and the matching client wrapper/page together.
- Keep browser-only APIs inside client components/effects or guarded code. `localStorage` is unavailable during server rendering.
- Do not add a second ad hoc `fetch` implementation in a page when `app/libs/api.ts` can own it.
- Read `AGENTS.md` before editing. It contains generated Next.js version-specific instructions and may be regenerated by `next dev`.
