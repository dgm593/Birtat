# Birtat 7.0 data schema and migration notes

## Compatibility strategy

- The primary local-storage key remains `birtat-v4` to avoid breaking the existing deployment.
- Legacy keys `birtat-v3`, `birtat-v2`, and `birtat-state` remain supported by the existing loader.
- The migration is additive. Existing `days`, `reviews`, `settings`, `semester`, and `meta` are retained.
- `meta.version` is updated to `7.0.0`; `schemaVersion` is set to `7`.
- When upgrading a pre-V7 `birtat-v4` payload, the original raw JSON is copied to `birtat-v4-pre-v7-backup` before the V7 state is saved. A backup is not created over an existing pre-V7 snapshot.
- Import validation checks the outer structure and relevant collection types before merging. Records with IDs are de-duplicated by stable ID; day-level study-session mirrors are de-duplicated by `sessionId`.
- Date keys use `YYYY-MM-DD`. The date for “today” follows the configurable IANA time zone, defaulting to the device's current zone. Calendar date arithmetic uses local date-only keys to avoid UTC midnight shifts.

## New top-level state

| Key | Purpose |
|---|---|
| `schemaVersion` | Current schema version (`7`) |
| `profile` | Name, wake/bedtime targets, study and gym targets, training days, phone target/cutoff, time zone and weekly review day |
| `timetable` | `recurring` class definitions, date-specific `exceptions`, and `oneOff` events |
| `tasks` | Scheduled personal blocks and task completion state |
| `academic` | Eight course records, weekly minute allocation, detailed independent-study sessions and recoverable active timer |
| `fitness` | Workout logs, exercise history, body measurements, nutrition entries and Upper/Lower templates |
| `phone` | Phone-free sessions, manual screen-time logs, scrolling-trigger logs, active focus timer and rules |
| `faith` | Daily faith commitment logs and custom scheduled commitments |
| `personal` | Books, reading sessions, skill goals and family commitments |
| `customHabits` | User-defined habits with frequency, schedule, pause periods and retirement history |
| `habitLogs` | Per-date states: `done`, `missed`, or `unrecorded` |
| `dailyReviews` | Daily reflection entries keyed by local date |
| `weeklyReviews` | Weekly review entries keyed by Monday's date |

## Timetable behavior

- A recurring event is stored once in `timetable.recurring` with `dayOfWeek` (`0` Sunday through `6` Saturday).
- A cancellation or individual-occurrence edit is stored under `timetable.exceptions["YYYY-MM-DD:event-id"]`; the recurring definition remains intact.
- One-off events are stored in `timetable.oneOff` and are not converted into recurring definitions.
- Time blocks and class events use 24-hour `HH:MM` times. Overlap checks reject invalid times and conflicts with other scheduled events.

## Study-session behavior

- Detailed sessions are stored once in `academic.sessions` with stable IDs, course, method, topic, output, mastery, notes, start/end timestamps and focused duration.
- A compatibility mirror is also written into the legacy day record's `studySessions` so existing semester reports can continue reading logged hours. The new analytics read the detailed `academic.sessions` collection, avoiding double counting.
- Lecture attendance is not added to independent study. Breaks should be excluded by ending the timer during breaks. If a timer has run for more than four hours, Birtat asks for the actual focused minutes before saving.

## Known legacy limitation

Old boolean habit records cannot distinguish a deliberately missed habit from a habit that was never recorded. V7 does not invent that historical distinction. New custom habits explicitly store `done`, `missed`, or `unrecorded`.
