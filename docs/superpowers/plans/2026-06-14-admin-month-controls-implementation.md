# Admin Month Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins can manage future months, edit closed-date availability safely, and download the selected month as JSON.

**Architecture:** Month navigation policy lives in `src/lib/calendar.ts` and is consumed by `loadScheduleData`. Server actions preserve closed `Day` rows when admins write availability. The calendar UI gets an admin-only month control strip and client-side JSON export from already loaded month data.

**Tech Stack:** Next.js App Router, React server actions, Prisma, PostgreSQL, Vitest, TypeScript.

---

## File Structure

- Modify `src/lib/calendar.ts`: add month policy helpers for admin/user month lists and fixed future horizon generation.
- Modify `src/lib/calendar.test.ts`: TDD coverage for admin 12-month horizon and normal-user public month range.
- Modify `src/lib/schedule-data.ts`: include month-level state in the loaded schedule and use the new month policy.
- Modify `src/app/actions.ts`: make admin availability writes preserve existing closed days and avoid reopening closed dates.
- Modify `src/app/actions.test.ts`: source-level regression test for closed-date admin writes.
- Modify `src/app/schedule-calendar.tsx`: add admin month controls, remove month controls from detail panel, and add JSON export.
- Modify `src/app/schedule-calendar.test.ts`: source-level tests for the admin month controls and JSON export.
- Modify `src/app/globals.css`: style the admin controls using the existing compact operational UI language.

---

### Task 1: Month Policy Helpers

**Files:**
- Modify: `src/lib/calendar.ts`
- Test: `src/lib/calendar.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these imports in `src/lib/calendar.test.ts`:

```ts
import {
  buildAdminMonths,
  buildMonthSpanThroughLatestOpenMonth,
  buildMonthRange,
  buildMonthDays,
  buildVisibleMonths,
  enumerateDateRange,
  getMonthDateRange,
} from "./calendar";
```

Add these tests:

```ts
describe("admin month policy", () => {
  it("returns the current month plus the next 11 months for admins", () => {
    expect(buildAdminMonths(new Date("2026-06-13T00:00:00Z"), [])).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
    ]);
  });

  it("keeps stored months outside the default admin horizon", () => {
    expect(
      buildAdminMonths(new Date("2026-06-13T00:00:00Z"), ["2027-08"]),
    ).toContain("2027-08");
  });
});

describe("normal user month policy", () => {
  it("includes closed months between the current month and latest open month", () => {
    expect(
      buildMonthSpanThroughLatestOpenMonth(
        new Date("2026-06-13T00:00:00Z"),
        ["2026-06", "2026-08"],
      ),
    ).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("falls back to the current month when no open months exist", () => {
    expect(
      buildMonthSpanThroughLatestOpenMonth(
        new Date("2026-06-13T00:00:00Z"),
        [],
      ),
    ).toEqual(["2026-06"]);
  });
});

describe("buildMonthRange", () => {
  it("builds an inclusive range between two month keys", () => {
    expect(buildMonthRange("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/calendar.test.ts --run`

Expected: FAIL because `buildAdminMonths`, `buildMonthSpanThroughLatestOpenMonth`, and `buildMonthRange` are not exported yet.

- [ ] **Step 3: Implement the helpers**

In `src/lib/calendar.ts`, add:

```ts
const ADMIN_MONTH_HORIZON = 12;

export function buildAdminMonths(anchor: Date, storedMonths: string[]): string[] {
  const anchorMonth = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1),
  );
  const months = new Set<string>();

  for (let offset = 0; offset < ADMIN_MONTH_HORIZON; offset += 1) {
    months.add(formatMonth(addMonths(anchorMonth, offset)));
  }

  for (const month of storedMonths) {
    if (isMonthKey(month)) {
      months.add(month);
    }
  }

  return [...months].sort();
}

export function buildMonthSpanThroughLatestOpenMonth(
  anchor: Date,
  openMonths: string[],
): string[] {
  const currentMonth = formatMonth(
    new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)),
  );
  const validOpenMonths = openMonths.filter(isMonthKey).sort();
  const latestOpenMonth = validOpenMonths.at(-1);

  if (!latestOpenMonth || latestOpenMonth < currentMonth) {
    return [currentMonth];
  }

  return buildMonthRange(currentMonth, latestOpenMonth);
}

export function buildMonthRange(startMonth: string, endMonth: string): string[] {
  const [startYear, startMonthNumber] = startMonth.split("-").map(Number);
  const [endYear, endMonthNumber] = endMonth.split("-").map(Number);
  const start = new Date(Date.UTC(startYear, startMonthNumber - 1, 1));
  const end = new Date(Date.UTC(endYear, endMonthNumber - 1, 1));
  const months: string[] = [];

  for (let cursor = start; cursor <= end; cursor = addMonths(cursor, 1)) {
    months.push(formatMonth(cursor));
  }

  return months;
}

function isMonthKey(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month);
}
```

Update `buildVisibleMonths` only if needed to reuse `buildMonthRange`; keep its existing tests passing.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/calendar.test.ts --run`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/calendar.ts src/lib/calendar.test.ts
git commit -m "feat: add admin month policy helpers"
```

---

### Task 2: Schedule Data Month Policy

**Files:**
- Modify: `src/lib/schedule-data.ts`
- Test: `src/app/schedule-calendar.test.ts`

- [ ] **Step 1: Write the failing source-level test**

In `src/app/schedule-calendar.test.ts`, add:

```ts
it("loads admin month navigation separately from normal user month navigation", () => {
  const source = readFileSync("src/lib/schedule-data.ts", "utf8");

  expect(source).toContain("buildAdminMonths");
  expect(source).toContain("buildMonthSpanThroughLatestOpenMonth");
  expect(source).toContain("openVisibleMonths");
  expect(source).toContain("isAdmin ? buildAdminMonths");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/schedule-calendar.test.ts --run`

Expected: FAIL because `schedule-data.ts` does not use the new helpers.

- [ ] **Step 3: Implement the schedule data policy**

In `src/lib/schedule-data.ts`, update the calendar imports:

```ts
import {
  buildAdminMonths,
  buildMonthDays,
  buildMonthSpanThroughLatestOpenMonth,
  formatMonth,
  parseDateKey,
} from "@/lib/calendar";
```

Replace the current visible-day month setup with:

```ts
  const visibleDayRows = await prisma.day.findMany({
    where: { isVisible: true },
    select: { date: true, isOpen: true },
  });
  const storedVisibleMonths = visibleDayRows.map((day) => formatMonth(day.date));
  const openVisibleMonths = visibleDayRows
    .filter((day) => day.isOpen)
    .map((day) => formatMonth(day.date));
  const months = isAdmin
    ? buildAdminMonths(today, storedVisibleMonths)
    : buildMonthSpanThroughLatestOpenMonth(today, openVisibleMonths);
```

Keep the existing selected-month fallback logic after the `months` value.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/app/schedule-calendar.test.ts --run`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/schedule-data.ts src/app/schedule-calendar.test.ts
git commit -m "feat: separate admin month navigation"
```

---

### Task 3: Admin Closed-Date Availability Writes

**Files:**
- Modify: `src/app/actions.ts`
- Test: `src/app/actions.test.ts`

- [ ] **Step 1: Write the failing regression test**

In `src/app/actions.test.ts`, add:

```ts
describe("admin closed-date availability writes", () => {
  it("preserves closed days instead of reopening them before setting availability", () => {
    const source = readFileSync("src/app/actions.ts", "utf8");
    const adminSetAvailabilitySource = actionSource(
      source,
      "adminSetAvailability",
    );

    expect(adminSetAvailabilitySource).toContain("ensureAdminEditableDay");
    expect(adminSetAvailabilitySource).not.toContain("await ensureDay");
    expect(source).toContain("async function ensureAdminEditableDay");
    expect(source).toContain("create: { date: parseDateKey(date), isOpen: false");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/actions.test.ts --run`

Expected: FAIL because `ensureAdminEditableDay` does not exist.

- [ ] **Step 3: Implement the admin helper**

In `src/app/actions.ts`, change `adminSetAvailability` to:

```ts
export async function adminSetAvailability(input: unknown) {
  await requireAdmin();
  const parsed = adminAvailabilityInputSchema().parse(input);
  await ensureAdminEditableDay(parsed.date);
  await upsertAvailability(
    parsed.userId,
    parsed.date,
    parsed.status,
    parsed.reason,
  );
  revalidatePath("/");
}
```

Add this helper near `ensureDay`:

```ts
async function ensureAdminEditableDay(date: string) {
  await prisma.day.upsert({
    where: { date: parseDateKey(date) },
    update: { isVisible: true },
    create: { date: parseDateKey(date), isOpen: false, isVisible: true },
  });
}
```

Keep `ensureDay` unchanged for normal-user writes.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/app/actions.test.ts --run`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/actions.ts src/app/actions.test.ts
git commit -m "fix: preserve closed dates for admin status edits"
```

---

### Task 4: Admin Month Controls and JSON Export UI

**Files:**
- Modify: `src/app/schedule-calendar.tsx`
- Modify: `src/app/globals.css`
- Test: `src/app/schedule-calendar.test.ts`

- [ ] **Step 1: Write the failing UI source tests**

In `src/app/schedule-calendar.test.ts`, add:

```ts
it("renders separate admin month controls outside the detail panel", () => {
  const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");

  expect(source).toContain("AdminMonthControls");
  expect(source).toContain("onSetMonthOpen");
  expect(source).toContain("onDownloadMonthJson");

  const detailPanelSource = source.slice(source.indexOf("function DetailPanel"));
  expect(detailPanelSource).not.toContain("onSetMonthOpen");
});

it("downloads the selected month as a json file", () => {
  const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");

  expect(source).toContain("downloadMonthJson");
  expect(source).toContain("schedule-${schedule.selectedMonth}.json");
  expect(source).toContain("application/json");
  expect(source).toContain("URL.createObjectURL");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/schedule-calendar.test.ts --run`

Expected: FAIL because the admin controls and export function do not exist yet.

- [ ] **Step 3: Add the JSON export function**

In `ScheduleCalendar`, add:

```ts
  function downloadMonthJson() {
    const payload = {
      month: schedule.selectedMonth,
      downloadedAt: new Date().toISOString(),
      days: schedule.days
        .filter((day) => day.inMonth)
        .map((day) => ({
          date: day.date,
          isOpen: day.isOpen,
          isVisible: day.isVisible,
          counts: day.counts,
          entries: day.entries.map((entry) => ({
            userName: entry.userName,
            status: entry.status,
            reason: entry.reason,
          })),
        })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `schedule-${schedule.selectedMonth}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
```

- [ ] **Step 4: Move month controls out of `DetailPanel`**

In the main render, after `</header>` and before the bulk bar, add:

```tsx
      {isAdmin ? (
        <AdminMonthControls
          selectedMonth={schedule.selectedMonth}
          days={schedule.days}
          isPending={isPending}
          onSetMonthOpen={setMonthOpen}
          onDownloadMonthJson={downloadMonthJson}
        />
      ) : null}
```

Remove `onSetMonthOpen` from the `DetailPanel` props and JSX usage. Keep `onSetDayOpen`.

- [ ] **Step 5: Add `AdminMonthControls`**

Add this component before `DetailPanel`:

```tsx
function AdminMonthControls({
  selectedMonth,
  days,
  isPending,
  onSetMonthOpen,
  onDownloadMonthJson,
}: {
  selectedMonth: string;
  days: ScheduleDay[];
  isPending: boolean;
  onSetMonthOpen: (isOpen: boolean) => void;
  onDownloadMonthJson: () => void;
}) {
  const inMonthDays = days.filter((day) => day.inMonth);
  const openCount = inMonthDays.filter((day) => day.isOpen).length;
  const totalCount = inMonthDays.length;
  const allOpen = totalCount > 0 && openCount === totalCount;

  return (
    <section className="admin-month-controls">
      <strong>{formatMonthLabel(selectedMonth)}</strong>
      <span>{allOpen ? "열림" : `닫힘 ${totalCount - openCount}`}</span>
      <div>
        <button
          type="button"
          disabled={isPending || allOpen}
          onClick={() => onSetMonthOpen(true)}
        >
          이 달 열기
        </button>
        <button
          type="button"
          disabled={isPending || openCount === 0}
          onClick={() => onSetMonthOpen(false)}
        >
          이 달 닫기
        </button>
        <button type="button" onClick={onDownloadMonthJson}>
          JSON 다운로드
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Style the admin controls**

In `src/app/globals.css`, add:

```css
.admin-month-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-inline: 1px solid var(--border);
  background: #fff;
  padding: 10px 16px;
}

.admin-month-controls strong {
  font-size: 13px;
  font-weight: 900;
}

.admin-month-controls span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.admin-month-controls div {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.admin-month-controls button {
  border: 1px solid var(--border);
  border-radius: 9px;
  background: #f8fafc;
  padding: 7px 9px;
  color: #334155;
  font-size: 11px;
  font-weight: 800;
}
```

Inside the existing `@media (max-width: 900px)` block, add:

```css
  .admin-month-controls {
    align-items: flex-start;
    flex-direction: column;
  }

  .admin-month-controls div {
    justify-content: flex-start;
  }
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- src/app/schedule-calendar.test.ts --run`

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/app/schedule-calendar.tsx src/app/globals.css src/app/schedule-calendar.test.ts
git commit -m "feat: add admin month controls"
```

---

### Task 5: Verification, Browser Check, and Push

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run full automated checks**

Run:

```bash
npm test -- --run
npx tsc --noEmit
npm run build
git diff --check
```

Expected:

- Vitest reports all tests passed.
- TypeScript exits 0.
- Next build exits 0.
- `git diff --check` exits 0.

- [ ] **Step 2: Run browser verification**

Use Playwright against the local app or deployed app to verify:

- Admin mode shows 12 months in the month selector.
- Admin month controls are visible.
- Month close/open buttons work.
- Closed month dates are grey for normal users.
- JSON download produces `schedule-YYYY-MM.json`.

- [ ] **Step 3: Push**

Run:

```bash
git push origin HEAD:feat/schedule-calendar-app
git push origin HEAD:main
```

Expected: both pushes exit 0.

---

## Self-Review

- Spec coverage: closed-date admin edit is Task 3; 12-month admin visibility and normal-user public range are Tasks 1 and 2; separate admin controls and JSON export are Task 4; verification and push are Task 5.
- Placeholder scan: no placeholder markers or vague implementation-only steps remain.
- Type consistency: `buildAdminMonths`, `buildMonthSpanThroughLatestOpenMonth`, `buildMonthRange`, `AdminMonthControls`, and `downloadMonthJson` names are consistent across tests and implementation steps.
