# Schedule Calendar

Mobile-friendly shared availability calendar for date-level scheduling.

## Features

- Cookie-backed anonymous users with editable display names.
- Duplicate names supported through short codes such as `#A7F2`.
- Four availability states: unavailable, maybe, special note, available.
- Special-note reasons visible from the selected date's user list.
- One-month calendar view with arrow navigation and a month dropdown.
- Fixed date-cell status slots:
  - Top left: unavailable.
  - Top right: maybe.
  - Bottom left: special note.
  - Bottom right: available.
- Zero-count states keep their slot empty instead of shifting positions.
- Multi-date selection and bulk status application.
- Admin password challenge for configured admin names.
- Admin controls for editing users, opening/closing dates, and opening/closing months.

## Local Setup

Install dependencies:

```powershell
npm install
```

Create `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
ADMIN_NAMES="admin"
ADMIN_PASSWORD="change-me"
ADMIN_SESSION_SECRET="replace-with-a-long-random-secret"
```

For a quick local PostgreSQL database without Docker, start Prisma dev:

```powershell
npx prisma dev --detach --name schedule-calendar
npx prisma dev ls
```

Use the TCP `DATABASE_URL` shown by `npx prisma dev ls` in your `.env`.

Apply migrations:

```powershell
npx prisma migrate deploy
```

Run the app:

```powershell
npm run dev
```

## Railway Deployment

1. Push this repository to GitHub.
2. In Railway, create a new project from the GitHub repository.
3. Add a Railway PostgreSQL database to the project.
4. Set the app service variables:
   - `DATABASE_URL`: reference the Postgres database URL.
   - `ADMIN_NAMES`: comma-separated admin names, for example `admin,관리자`.
   - `ADMIN_PASSWORD`: password required when one of those names is entered.
   - `ADMIN_SESSION_SECRET`: long random string used to sign admin sessions.
5. Railway uses `railway.json`:
   - Build command: `npm run build`
   - Start command: `npx prisma migrate deploy && npm run start`

## Verification

```powershell
npm test
npm run build
```
