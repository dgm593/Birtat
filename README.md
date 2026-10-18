# Birtat 7.0 · Personal Discipline Command Center

Birtat remains a static, installable Progressive Web App. It uses the existing HTML/CSS/JavaScript architecture and browser `localStorage`; it does not require a backend, account, external API, or third-party runtime library.

## Files

- `index.html` — existing app plus command-center dashboard and systems workspace.
- `style.css` — preserved dark-and-gold design with responsive V7 module styles.
- `script.js` — existing app logic plus V7 data migration, timetable, study, fitness, phone, faith, habit, review and personal-development logic.
- `manifest.json` — PWA metadata and app shortcuts.
- `service-worker.js` — cache-first offline strategy, bumped to `birtat-v7-0`.
- `assets/icons/icon.svg` — restored icon asset required by the service-worker precache list.
- `MIGRATION-NOTES.md` — schema and backward-compatibility notes.
- `TEST-REPORT.md` — checks performed and limitations.

## Run locally

Use a local static HTTP server rather than opening `index.html` directly. From this folder, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. Service workers are supported on localhost for development. For installation on Android, serve the app over HTTPS (for example, through the existing GitHub Pages site).

## Deploy to the existing static host

1. **Back up your current app data first.** In Birtat, use the existing Profile / Data export function to download a JSON backup.
2. Keep a copy of the current repository files before replacing them.
3. Copy the contents of this package into the same published project root. Preserve the `assets/icons/icon.svg` path.
4. Commit and push the updated files to the same branch and path currently used by the existing static host. Do not change the site origin or subpath unless you intend to move browser-local data manually.
5. Open the existing HTTPS site while online, let it load once, then reload it. The service-worker cache name changed to `birtat-v7-0` so the old cache is replaced on activation.
6. Open **Systems → Settings** and verify the profile and targets. Check **Systems → Timetable** and **Systems → Academics** before relying on the schedule.
7. Test offline use by opening the app online once, then disconnecting the device and reopening it. Reconnect before restoring a backup or deploying another version.

## Data safety

The migration keeps the existing `birtat-v4` storage key and preserves legacy `days`, `reviews`, `settings`, `semester`, and `meta` data. On a first upgrade from an older `birtat-v4` payload, it stores the raw pre-upgrade JSON in local storage as `birtat-v4-pre-v7-backup`. If present, this snapshot can be downloaded from **Systems → Settings → Data safety**. The existing Profile / Data JSON export remains the recommended backup/restore workflow.

Browser storage is local to the site origin and browser profile. Clearing site data, changing browsers, or changing the site origin can make local records unavailable. Keep periodic JSON backups somewhere outside the browser.

## Phone blocking limitation

A normal web PWA cannot pause arbitrary Android apps or read all system-wide screen-time data. Birtat stores manual screen-time entries, phone-free focus sessions, rules and scrolling triggers. Use Android **Digital Wellbeing → Focus mode**, **App timers** and **Bedtime mode** for actual system-level restrictions.
