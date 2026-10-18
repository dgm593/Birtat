# Birtat 7.1 · Simplified Interface Preview

Birtat 7.1 is a **UI refinement of the existing Birtat 7.0 package**, not a rebuild. The goal is to reduce the number of decisions shown on the home screen while keeping the underlying features available.

## What's changed

- Main navigation is now **Home · Today · Focus · More**.
- Home shows the greeting/date, today's class schedule, a gym-day/rest-day card, a compact next-commitment summary, progress, and quick actions.
- Repeated legacy dashboard sections (six-pillar grid, separate focus list, score legend, and duplicated stats) are no longer shown on Home. Their source logic and the full Today/Calendar/Review pages remain.
- Systems has four primary tabs (Faith, Study, Physique, Personal); Timetable, Phone, Habits, Reviews, and Settings are grouped under one More tools selector. The main bottom navigation remains Home, Today, Focus, and More.
- Profile memory entries are filed into one collapsible Memory Archive, grouped by month and then by day, with search retained.
- Dark-and-gold styling and the existing mobile-first layout are retained.
- The service-worker cache version is updated to `birtat-v7-1-daily-command` so the UI assets can refresh after a future deployment.

## Data and hosting safety

- This package has **not** been deployed to GitHub Pages.
- The `birtat-v4` local-storage key, migration logic, application state schema, and data-writing logic were not intentionally changed. In `script.js`, the only code change is the addition of a `more` navigation case.
- Keep the current GitHub Pages repository, publishing branch/folder, custom domain, and URL. Do not upload a JSON personal backup into the repository.
- Before deploying, export a JSON backup from the live app and keep a copy of the current published files or use Git history for rollback.
- Because the live repository URL and publishing path have not been provided in this conversation, this is a separate package for review, not a live update.

## Local preview

From this folder, run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`. A local HTTP server is preferable to opening `index.html` directly because service workers require HTTPS or localhost.

## Safe review checklist

1. Open Home and check the reduced layout.
2. Use More to open Faith, Academics, Timetable, Physique, Phone discipline, Personal, Habits, Reviews, Settings, Calendar, Semester, Analytics, and Profile/data.
3. Confirm the Today tracker and existing records behave as before.
4. Confirm the browser's existing local data remains visible. Do not test migration on your only copy of important data.
5. Test install/offline behavior on the same origin before any live deployment.

## Important limitation

A headless browser test was attempted in this environment but navigation was blocked by the environment policy. JavaScript syntax, HTML structure, navigation target coverage, manifest validity, and service-worker precache paths were checked; visual Android testing and a real offline round-trip still need to be done on your device.
