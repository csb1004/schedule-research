# Name-Based Reentry Design

## Goal

Make the schedule calendar easier to use as a temporary coordination tool by treating the same entered display name as the same user. Users will not need an account, password, or short code to return and edit their previous availability.

## Scope

- Keep the first screen as a single-name entry flow.
- When a non-admin name is submitted:
  - If a user with the exact same normalized display name already exists, set the user cookie to that existing user.
  - If no matching user exists, create a new user.
- Keep the existing admin-password challenge for names listed in `ADMIN_NAMES`.
- Hide short codes from the user-facing UI because they no longer serve a visible identification purpose.
- Keep short codes in the database for now to avoid an unnecessary destructive migration.

## Non-Goals

- No username/password account system.
- No password rules.
- No email verification.
- No user-facing account recovery.
- No attempt to prevent someone from using another normal user's name. This is acceptable because the site is intended for temporary, low-friction scheduling.

## Name Matching

Names are matched after trimming leading and trailing whitespace. The first implementation will use exact, case-sensitive matching after trim. This preserves Korean names naturally and avoids surprising changes to already-entered names.

If several existing users already have the same display name from the previous cookie-only behavior, the app will reuse the oldest matching user. This avoids blocking users while keeping behavior deterministic. Merging duplicate historical users is outside this change.

## Admin Flow

Admin names remain protected:

- If the entered name is in `ADMIN_NAMES` and no admin password is provided, the form asks for the admin password.
- If the admin password is wrong, the user is not signed in.
- If the admin password is correct:
  - Reuse the existing user with that display name if present.
  - Otherwise create the user.
  - Set both the normal user cookie and the admin session cookie.

Normal users cannot bypass admin protection by entering an admin name without the admin password.

## Data Model

The `User` table can remain mostly unchanged:

- `displayName` remains the visible identity.
- `shortCode` remains required and unique internally.
- New users still receive a generated short code.

No database migration is required for this change.

## UI Changes

- The entry form copy will present the field simply as "이름".
- The current user control will show only the display name, not `#shortCode`.
- The selected-date user list will show only each user's display name.
- Settings will continue to allow display name changes, but updating to a name already used by another user will be blocked to avoid creating future ambiguity.

## Behavior After Renaming

If a signed-in user changes their display name:

- Empty names are rejected.
- A display name already used by another user is rejected.
- The user's existing availability remains attached to the same user record.

This keeps the name-based reentry rule predictable.

## Error Handling

- Empty name: show the existing validation error.
- Duplicate rename: show a clear error such as "이미 사용 중인 이름입니다."
- Admin password failure: keep the existing admin-password error behavior.
- Existing duplicate names in old data: reuse the oldest matching user silently.

## Testing

Add tests around the identity helper/action behavior:

- Existing non-admin name reuses the existing user instead of creating a duplicate.
- New non-admin name creates a user.
- Admin name still requires the admin password.
- Duplicate rename is rejected.
- UI source no longer renders `shortCode` in user-facing labels.

Run the existing full verification:

- `npm test`
- `npm run build`

## Deployment

This is a normal code-only deploy. No Railway variable changes are required, and no Prisma migration is required.
