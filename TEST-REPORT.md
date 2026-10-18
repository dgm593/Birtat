# Birtat 7.0 test report

## Automated checks completed

- JavaScript syntax: `node --check script.js` — passed.
- Service-worker syntax: `node --check service-worker.js` — passed.
- HTML parsed with Python's `HTMLParser` — passed.
- `manifest.json` parsed as valid JSON — passed.
- Static inline-handler scan — no unresolved static handlers found.
- Duplicate HTML IDs — none found.
- Service-worker precache paths — all referenced files exist in the package.
- Logic tests using Node's VM with a mocked DOM and local-storage implementation — **51/51 passed**.

## Tested logic

- Legacy data migration and pre-V7 snapshot creation.
- Preservation of legacy habits, study sessions, reviews and semester course data.
- Bio-fluid Mechanics inclusion and the 17 default recurring timetable events.
- Cancellation/restoration of one class occurrence without deleting the recurring class.
- Time-block conflict detection and invalid time rejection.
- Focused study session logging and legacy day-record compatibility.
- Workout exercise detail persistence and built-in Upper/Lower templates.
- Custom habit `done` state, pause-period history, time-zone date selection and Monday-start weeks.
- Manual screen-time logging and faith schedule storage.
- Import structure validation, JSON restore, de-duplication and simulated reload persistence.
- Rendering entry points for the nine V7 workspace tabs and command-center dashboard against mocked DOM elements.

## Not verified in this environment

A real Android browser session and service-worker installation/offline round-trip were not completed. The available headless Chromium process failed to launch reliably in this environment, so the checks above are not a substitute for visual browser testing. Before relying on the deployment, test the app on your Android browser and verify: installability, navigation, keyboard/input behavior, offline logging, JSON export/import and a real migration with your own saved data.
