# Schedule Calendar Design

## Goal

Build a mobile-friendly online schedule calendar for coordinating date availability across multiple users. The app will be deployed to Railway from GitHub and use Railway PostgreSQL for persistence.

## Platform

- Framework: Next.js
- Database: Railway PostgreSQL
- ORM: Prisma
- Deployment: GitHub repository connected to Railway
- Identity: cookie-backed anonymous user ID with editable display name

## User Identity

On first visit, the user enters a display name. The server creates a random user ID and a short public discriminator code, such as `#A7F2`.

The browser stores the user ID in a cookie so later visits keep the same identity. The UI displays users as `name #code`. Users can change their display name in settings without changing their underlying ID.

Duplicate names are allowed because the short code distinguishes people with the same name.

The cookie stores only the random user ID. The server remains the source of truth for the display name and short code.

## Admin Identity

Admin names are configured through the Railway environment variable `ADMIN_NAMES`, using a comma-separated list.

When a visitor enters a name that matches `ADMIN_NAMES`, the app asks for the admin password. The password is stored in a Railway environment variable. If the password is correct, the session is marked as admin.

Admin state is stored separately from the user identity cookie, using a signed `httpOnly` admin-session cookie. Admin rights are never inferred from display name alone after the initial password challenge.

Admins can:

- Open or close dates individually.
- Open or close an entire month at once.
- View closed-date details.
- Edit any user's availability status and special-note reason.

Normal users cannot see status counts, user lists, or details for closed dates.

## Calendar Scope

By default, the app shows the current month plus the next two months. The app can also include admin-added months or date ranges later.

The UI shows one month at a time. Users move between visible months with left and right arrow buttons. Clicking the month title opens a month list below the title, allowing direct navigation to another visible month.

## Date Visibility

Each date has an open or closed state.

For normal users:

- Open dates show availability counts.
- Closed dates appear as empty gray dates.
- Closed dates do not show status colors, counts, users, or notes.
- Closed dates cannot be selected or edited.

For admins:

- Closed dates remain inspectable.
- Admins can view and edit responses on closed dates.
- Admin controls support both single-date and whole-month open/close actions.
- Admins can add extra visible date ranges beyond the default three-month range.

## Availability Statuses

Each user can set one status per date:

- Unavailable: red
- Maybe: yellow
- Available: green
- Special note: blue

If the selected status is special note, the user must be able to enter a separate reason. Clicking a user with a special note reveals the reason. Admins can view and edit this reason.

## Date Cell Display

Each date cell shows status counts using a fixed two-by-two layout:

- Top left: red, unavailable
- Top right: yellow, maybe
- Bottom left: blue, special note
- Bottom right: green, available

Statuses with zero users are not displayed, but their slot remains empty so the remaining statuses do not shift position. This keeps scanning consistent across dates.

Date cells use compact colored dots plus numbers. The full status names are not shown inside date cells.

## Date Detail Panel

Selecting an open date opens a detail panel.

On desktop, the panel appears beside the calendar. On mobile, it appears as a bottom sheet so the calendar remains usable on a narrow screen.

The detail panel includes:

- Date title.
- Status summary counts.
- Colored status buttons for the current user: red, yellow, green, and blue with white text.
- User list with names and short codes.
- Each user's status shown as a small colored pill with white text.
- Special-note reason display when selecting a special-note user.

Admins see edit controls for every listed user.

## Bulk Selection

The calendar includes a multi-date selection mode.

When enabled, users can tap multiple dates and apply one availability status to all selected open dates. Special-note bulk application should support entering one note reason that applies to all selected dates.

Closed dates are not selectable by normal users. Admins can select closed dates for admin actions.

## Responsive Behavior

The app must work well on mobile.

Mobile requirements:

- One month per screen.
- Large enough date cells for touch use.
- Month navigation remains at the top.
- Date detail appears as a bottom sheet.
- Status controls are large, colored buttons.
- Text must not overflow inside buttons, date cells, or user rows.
- The UI should not require horizontal scrolling for the calendar grid.

Desktop requirements:

- One month per screen.
- Calendar and selected-date detail can sit side by side.
- Toolbar actions remain visible and easy to scan.

## Data Model

Expected Prisma models:

- `User`: internal ID, display name, short code, timestamps.
- `Day`: date, open/closed state, visible state, timestamps.
- `Availability`: user ID, date, status, optional reason, timestamps.

`Availability` should be unique per user and date.

## API Behavior

The app should expose server actions or API routes for:

- Creating or restoring the current user from cookie.
- Updating the current user's display name.
- Checking admin credentials for admin-name entries.
- Fetching month calendar data with visibility rules applied.
- Updating the current user's availability.
- Bulk updating the current user's availability.
- Admin updating any user's availability.
- Admin opening or closing dates.
- Admin opening or closing months.

Normal-user responses must not include closed-date counts, users, or note reasons.

## Error Handling

- If the cookie references a missing user, the app should ask for a name again and create a fresh user.
- If admin password validation fails, the user remains non-admin and sees a clear error.
- If a normal user tries to update a closed date, the server rejects the request.
- If a special-note status is submitted without a reason, the UI should ask for the reason before saving.

## Testing

Implementation should include focused checks for:

- Cookie-backed user creation and restoration.
- Duplicate display names with distinct short codes.
- Closed-date visibility differences between normal users and admins.
- Status-count aggregation and fixed slot ordering.
- Single-date and bulk availability updates.
- Admin month open/close behavior.
- Mobile layout sanity through browser verification.
