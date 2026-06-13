# Schedule Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Railway-ready Next.js schedule calendar with cookie-backed users, admin controls, PostgreSQL persistence, fixed-slot date counts, and mobile-friendly interaction.

**Architecture:** Use the Next.js App Router with server actions for mutations and Prisma for PostgreSQL access. Keep calendar/domain logic in small pure TypeScript modules so the important visibility, aggregation, and date-range rules are testable without a browser or database. Render one client-side interactive calendar shell fed by server-loaded initial state.

**Tech Stack:** Next.js, React, TypeScript, Prisma, PostgreSQL, Vitest, CSS Modules/global CSS.

---

## File Structure

- Create `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `postcss.config.mjs`: project tooling.
- Create `prisma/schema.prisma`: `User`, `Day`, and `Availability` models.
- Create `src/lib/status.ts`: status enum, labels, colors, fixed slot order.
- Create `src/lib/calendar.ts`: month math, visible month list, date cells.
- Create `src/lib/availability.ts`: count aggregation and closed-date sanitization.
- Create `src/lib/admin.ts`: admin-name parsing and signed admin cookie helpers.
- Create `src/lib/user.ts`: short code generation and user display helpers.
- Create `src/lib/prisma.ts`: Prisma client singleton.
- Create `src/app/actions.ts`: server actions for identity, availability, bulk updates, and admin date controls.
- Create `src/app/page.tsx`: server entry point that loads current user and month data.
- Create `src/app/schedule-calendar.tsx`: client calendar UI.
- Create `src/app/globals.css`: final responsive visual design.
- Create `src/app/layout.tsx`: app metadata and global styles.
- Create `src/lib/*.test.ts`: Vitest unit tests for domain rules.
- Create `.env.example`, `README.md`, and `railway.json`: local/deployment guidance.

## Task 1: Project Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `postcss.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Create project config**

Create a Next.js TypeScript app by installing dependencies:

```powershell
npm init -y
npm install next@latest react@latest react-dom@latest @prisma/client@latest prisma@latest zod@latest
npm install -D typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest vitest@latest jsdom@latest eslint@latest eslint-config-next@latest
```

Then replace `package.json` scripts with:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  }
}
```

- [ ] **Step 2: Verify tooling baseline**

Run:

```powershell
npm test
```

Expected: Vitest runs and reports the current suite state. Task 2 adds the first behavior tests.

## Task 2: Core Domain Tests First

**Files:**
- Create: `src/lib/status.test.ts`
- Create: `src/lib/calendar.test.ts`
- Create: `src/lib/availability.test.ts`
- Create: `src/lib/admin.test.ts`
- Create: `src/lib/status.ts`
- Create: `src/lib/calendar.ts`
- Create: `src/lib/availability.ts`
- Create: `src/lib/admin.ts`
- Create: `src/lib/user.ts`

- [ ] **Step 1: Write failing tests**

Create tests that assert:

```typescript
expect(STATUS_SLOTS.map((slot) => slot.status)).toEqual([
  "UNAVAILABLE",
  "MAYBE",
  "SPECIAL",
  "AVAILABLE",
]);
```

```typescript
expect(buildVisibleMonths(new Date("2026-06-13T00:00:00Z"), [])).toEqual([
  "2026-06",
  "2026-07",
  "2026-08",
]);
```

```typescript
expect(aggregateStatusCounts([
  { status: "AVAILABLE" },
  { status: "AVAILABLE" },
  { status: "SPECIAL" },
])).toEqual({
  UNAVAILABLE: 0,
  MAYBE: 0,
  SPECIAL: 1,
  AVAILABLE: 2,
});
```

```typescript
expect(sanitizeClosedDayForUser({
  date: "2026-06-04",
  isOpen: false,
  counts: { UNAVAILABLE: 1, MAYBE: 1, SPECIAL: 1, AVAILABLE: 1 },
  entries: [{ userName: "Alex", status: "AVAILABLE" }],
}, false)).toMatchObject({
  isOpen: false,
  counts: { UNAVAILABLE: 0, MAYBE: 0, SPECIAL: 0, AVAILABLE: 0 },
  entries: [],
});
```

```typescript
expect(parseAdminNames("owner, admin ,Alex")).toEqual(["owner", "admin", "Alex"]);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test
```

Expected: FAIL because the imported modules do not exist.

- [ ] **Step 3: Implement domain helpers**

Implement:

- `Status` union and `STATUS_SLOTS` in fixed order: red unavailable, yellow maybe, blue special, green available.
- `buildVisibleMonths(anchor, extraMonths)` returning current month plus next two months plus sorted unique extras.
- `aggregateStatusCounts(entries)` returning all four keys with zero defaults.
- `sanitizeClosedDayForUser(day, isAdmin)` hiding counts and entries when `day.isOpen === false && !isAdmin`.
- `parseAdminNames(value)` trimming comma-separated names and dropping blanks.
- `createShortCode()` returning a four-character uppercase alphanumeric code.

- [ ] **Step 4: Run tests to verify pass**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts postcss.config.mjs src/lib src/app/layout.tsx src/app/globals.css
git commit -m "feat: add project foundation and calendar domain helpers"
```

## Task 3: Prisma Schema and Data Access

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `.env.example`

- [ ] **Step 1: Write schema**

Create Prisma models:

```prisma
model User {
  id             String         @id @default(cuid())
  displayName    String
  shortCode      String         @unique
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  availabilities Availability[]
}

model Day {
  date           DateTime       @id @db.Date
  isOpen         Boolean        @default(true)
  isVisible      Boolean        @default(true)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  availabilities Availability[]
}

model Availability {
  id        String   @id @default(cuid())
  userId    String
  date      DateTime @db.Date
  status    Status
  reason    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  day       Day      @relation(fields: [date], references: [date], onDelete: Cascade)

  @@unique([userId, date])
  @@index([date])
}

enum Status {
  UNAVAILABLE
  MAYBE
  SPECIAL
  AVAILABLE
}
```

- [ ] **Step 2: Generate Prisma client**

Run:

```powershell
npx prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 3: Add Railway/local env template**

Add `.env.example` with:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
ADMIN_NAMES="admin"
ADMIN_PASSWORD="change-me"
ADMIN_SESSION_SECRET="replace-with-a-long-random-secret"
```

- [ ] **Step 4: Commit**

```powershell
git add prisma/schema.prisma src/lib/prisma.ts .env.example
git commit -m "feat: add prisma data model"
```

## Task 4: Server Actions

**Files:**
- Create: `src/app/actions.ts`
- Modify: `src/lib/admin.ts`
- Modify: `src/lib/user.ts`
- Modify: `src/lib/calendar.ts`

- [ ] **Step 1: Add tests for admin cookie signing**

Add tests that verify `signAdminSession("user-id", "secret")` produces a token accepted by `verifyAdminSession(token, "secret")`, and rejected with a different secret.

- [ ] **Step 2: Run tests to verify fail**

Run:

```powershell
npm test
```

Expected: FAIL because signing helpers are missing.

- [ ] **Step 3: Implement server helpers and actions**

Implement server actions:

- `enterName(formData)` creates or updates current user and handles admin challenge result.
- `verifyAdminPassword(formData)` validates `ADMIN_PASSWORD` for matched admin names and sets signed admin cookie.
- `updateDisplayName(formData)` updates current user.
- `setAvailability(input)` upserts one user's status for one date.
- `bulkSetAvailability(input)` upserts one status for multiple dates.
- `adminSetAvailability(input)` updates any user's status.
- `adminSetDayOpen(date, isOpen)` changes one date.
- `adminSetMonthOpen(month, isOpen)` changes all days in the month.
- `adminAddVisibleRange(startDate, endDate)` ensures visible `Day` rows exist.

Use `revalidatePath("/")` after mutations.

- [ ] **Step 4: Run tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/actions.ts src/lib/admin.ts src/lib/user.ts src/lib/calendar.ts src/lib/*.test.ts
git commit -m "feat: add identity and calendar server actions"
```

## Task 5: Calendar UI

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/app/schedule-calendar.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Implement server page data loading**

`page.tsx` should:

- Read current user cookie.
- Load or request name entry.
- Determine admin status from signed cookie.
- Load visible months.
- Load selected month days and availability summaries.
- Pass serialized data to `ScheduleCalendar`.

- [ ] **Step 2: Implement client UI**

`ScheduleCalendar` should include:

- One-month calendar grid.
- Previous/next month arrow buttons.
- Month title dropdown list.
- Fixed 2x2 date status slots.
- Closed-date normal-user hiding.
- Desktop side detail panel.
- Mobile sticky bottom detail sheet.
- Colored status buttons with white text.
- Small colored user status pills.
- Special-note reason display.
- Multi-date selection mode and bulk apply form.
- Admin date/month controls.
- Settings dialog for display name.

- [ ] **Step 3: Style responsive layout**

CSS must enforce:

- No horizontal scroll for the calendar grid.
- Touch-friendly date cells.
- Bright red/yellow/blue/green status colors.
- Fixed slot positions in date cells.
- Mobile bottom sheet behavior.

- [ ] **Step 4: Run build**

Run:

```powershell
npm run build
```

Expected: Next.js builds successfully.

- [ ] **Step 5: Commit**

```powershell
git add src/app/page.tsx src/app/schedule-calendar.tsx src/app/globals.css
git commit -m "feat: build responsive schedule calendar UI"
```

## Task 6: Deployment Docs and Verification

**Files:**
- Create: `README.md`
- Create: `railway.json`
- Modify: `package.json`

- [ ] **Step 1: Add deployment docs**

Document:

- Railway Postgres requirement.
- Required environment variables.
- `npm run build` command.
- `npx prisma migrate deploy` migration command for deployment.

- [ ] **Step 2: Add Railway config**

Use:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npx prisma migrate deploy && npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

- [ ] **Step 3: Final verification**

Run:

```powershell
npm test
npm run build
```

Expected: both pass.

- [ ] **Step 4: Start dev server for manual check**

Run:

```powershell
npm run dev
```

Expected: app available locally, with no terminal errors.

- [ ] **Step 5: Commit**

```powershell
git add README.md railway.json package.json package-lock.json
git commit -m "docs: add railway deployment guide"
```

## Self-Review

- Spec coverage: identity, admin challenge, PostgreSQL persistence, one-month UI, fixed slots, mobile layout, closed-date visibility, bulk selection, and Railway deployment are all mapped to tasks.
- Red-flag scan: no deferred-work markers are intentionally present.
- Type consistency: status strings are consistently `UNAVAILABLE`, `MAYBE`, `SPECIAL`, and `AVAILABLE`.
