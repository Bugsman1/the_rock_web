# Handoff

## The project

- **What:** `the_rock_web`, the web frontend of an ERP for a gold-ore mill. It covers shipments,
  grinding (milling), mercury, refining, inventory, customers, settlements, users and roles, and
  settings.
- **Where:**
  - Frontend: `C:\Users\mousy\Desktop\the_rock_web`.
  - Backend (Django REST, separate repo): `C:\Users\mousy\Desktop\tayea_mills`, from GitHub
    `medDhmin/tayea_mills`.
  - Production: `https://soukhour.net` (app, with the API on its own origin under `/api`) and
    `https://api.soukhour.net` (API for other clients). Both are served by this repo's Caddy in
    Docker on the same VPS as the backend.
- **Stack:** React 19, Vite, React Router data routes (loaders and revalidation), TypeScript strict,
  Tailwind 4 with design tokens, and use-intl (Arabic RTL by default, plus French). Forms use
  react-hook-form with Zod factory schemas. The API client is openapi-fetch, with types generated
  in `src/lib/api/schema.d.ts`. Tests use Vitest, Testing Library and MSW.
- **Rules:** `CLAUDE.md` (strict) and `docs/ARCHITECTURE.md`, which describes every route, file and
  behaviour. Read both before any change. `npm run verify` must pass.

## Work done with Claude (summary)

- Backend sync:
  - Settlements module: project cards, only fully ground and refined shipments, grinding cost per
    bag, and a `settlements` role permission.
  - Mercury: entered when a grinding is "mercured" and taken from stock.
  - Refining: the weight before comes from the mercury.
  - Inventory history: taken, returned, loss, and the quantity before and after.
  - Shipment debts and their history.
- UI:
  - One shared `DataTable` with search in the table header.
  - Toasts appear after the form closes.
  - A red connection-lost bar, and no endless skeleton when offline.
  - Read-only automatic dates.
  - Bag and machine limits, the mercury minimum and refining weight rules.
  - "Discard changes?" on Cancel.
  - Fix for the drawer stuck open in Safari.
  - Phones sent without spaces.
- Deployment: Dockerfile, `docker-compose.yml`, `docker/Caddyfile` and `.env.example` (`DOMAIN`,
  `API_DOMAIN`, `BACKEND_URL`, `BACKEND_NETWORK`). `Accept-Language` is sent on every call.
- Audit of the frontend business logic, which found backend gaps A1–A4 and frontend issues B1–B11.
  Rule: the frontend is never the source of truth.

## Phase 1 of the audit (B4 + B5): done, not committed yet

- `src/lib/api/client.ts` `saveOutcome`:
  - A 400 maps backend errors onto form fields.
  - Any other 4xx message (`non_field_errors`, `detail`, unmapped fields) is shown in the backend's
    words.
  - A 5xx never shows its body.
  - 502/503/504, a timeout or a lost connection count as an unknown outcome (`unknown: true`).
- `src/components/ui/FieldError.tsx`: `useSaveFailure` and `SaveFailureMessage`. It shows
  `common.saveUnknown` for an unknown outcome.
- `src/components/ui/Drawer.tsx`: `DrawerActions locked`. After an unknown outcome the save button
  is hidden and Cancel closes the form without asking.
- `AppShell.tsx`: `useRevalidateOnReconnect` reloads the page data when the connection comes back.
- 14 forms were switched to `useSaveFailure`. The mercury form now shows the backend's own messages,
  and `milling.mercury.notEnoughStock` and `cannotAdd` were removed.
- Tests added or updated:
  - `client.test.ts`
  - `Drawer.test.tsx`
  - `CustomerForm.test.tsx`
  - `AppShell.test.tsx`
  - `MercuryForm.test.tsx`

  `npm run verify` passed (650 tests).

- Backend dependency: the backend has no idempotency support. A repeated save after an unknown
  outcome can duplicate a record. The needed change (an `Idempotency-Key` header) is in
  `docs/ARCHITECTURE.md` §9.

## Phase 2 of the audit (B3 + B8): done, not committed yet

- B8: `refiningQueue` requires ended + mercury added + no refining. A failed refinings load shows the
  error page with "try again" on both refining pages (no queue, no new or edit form). Ending a
  grinding without mercury closes the drawer and reloads the machine instead of opening refining.
- B3: `useSaveFailure` reloads the page data (`revalidate`) after a definite refusal, keeping the
  typed values and the backend message; never after an unknown outcome. If the record is gone after
  the reload, the drawer closes and a red toast shows `common.recordChanged`. A failed reload shows
  the error page, which drops pending toasts (`useDismissToast`).
- `Toast.tsx` gained a `danger` tone (4 s) and `useDismissToast`.
- Form tests now render inside a data router. Refining screen tests were split
  (`RefiningScreen.test.tsx`, `RefiningScreenFailures.test.tsx`, fixtures in `refiningTesting.tsx`).
  `npm run verify` passed (664 tests).

## Single-project users (done, not committed yet)

- Grinding (`millingLoader`) and Refining (`refiningLoader`) redirect a user who sees one project in
  service straight to that project's page, like Shipments and Settlements; the project page then has
  no back link.

## Shipments history filter and clients list (done, not committed yet)

- Shipments history: client picker (`historyClients`, matched by phone) + arrival date from / to,
  combined; with a client chosen the count shows that client's shipments and bags.
- Clients: the client page (`CustomerScreen`, route `customers/:customer`, `customerHref`,
  `DebtNotice`, `customers.detail` texts) was deleted; the list shows name, phone, date added and
  edit only. The user will say later what to add.

## Open backend gaps (from the audit)

- A1: the backend doesn't check whether a machine is already busy.
- A2: the backend doesn't lock the bag-limit check.
- A3: the backend doesn't validate `start_time`.
- A4: settlements accept shipments that aren't finished.
- No idempotency keys.
