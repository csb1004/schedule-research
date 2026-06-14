# Admin Month Controls Design

## Goal

Fix admin availability edits on closed dates, let admins manage future months beyond the current public range, and let admins download the selected month as JSON.

## Requirements

- Admins can set or update a user's status on a closed date without an action error.
- Admins can see and manage 12 months starting from the current month.
- Normal users see months only through the last opened/public month.
- If a closed month sits between opened months, normal users still see that month, but its dates remain grey and disabled.
- Months after the last opened/public month are visible only to admins until an admin opens them.
- Month open/close controls move out of the date detail panel into a separate admin month control area.
- Admins can download the currently selected month as a JSON file.

## Approach

The server will build month navigation differently for admins and normal users.

- Admin month list: current month plus the next 11 months, merged with any stored visible/open months.
- User month list: current month through the latest month that contains at least one open visible day, including any closed months in between.
- Selected month fallback remains the current month when the requested month is not allowed for that user.

Closed-day availability edits will use a single helper that ensures the target `Day` row exists without reopening the date. Admin status writes must preserve the current `isOpen` state instead of creating an open day by accident.

The UI will add a compact admin-only month control strip near the existing toolbar. It will contain:

- current month state text
- open month button
- close month button
- JSON download button

The existing date-level admin open/close controls can remain in the detail panel for individual date management, but month-level controls will no longer live there.

## JSON Shape

The downloaded file will be generated from the loaded month data already available in the client. The filename will be:

```text
schedule-YYYY-MM.json
```

The JSON payload will include:

- `month`
- `downloadedAt`
- `days`
- each day: `date`, `isOpen`, `isVisible`, `counts`, `entries`
- each entry: `userName`, `status`, `reason`

Short codes and internal user ids will not be included in the export because the requested use case is month data review, not database restoration.

## Error Handling

- If a normal user reaches a month outside their allowed range, the server falls back to the allowed month list.
- If an admin downloads a month with no entries, the file still downloads with empty day entries and zero counts.
- Admin writes on closed dates preserve closed visibility and do not fail because of missing `Day` rows.

## Testing

- Add unit coverage for user/admin month list policy.
- Add source-level regression coverage for admin closed-date writes preserving closed days.
- Add source-level UI coverage for the separate admin month controls and JSON download.
- Run the existing test, typecheck, build, and browser verification after implementation.

## Visual Design

Use the existing compact toolbar style. The admin month controls should read as operational controls, not a new panel. On mobile, the controls wrap below the main toolbar without overlapping the calendar.
