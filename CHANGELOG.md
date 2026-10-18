# Birtat 7.1 UI Refinement

## Goal
Reduce decision fatigue while preserving Birtat 7.0's existing functionality, local data schema, and GitHub Pages setup.

## Changes
- Reduced the bottom navigation to Home, Today, Focus, and More.
- Simplified Home to the daily command center; removed duplicated legacy dashboard blocks from the home markup.
- Added a More page that groups secondary pages and modules into clear destinations.
- Kept Faith, Academics, Timetable, Physique, Phone discipline, Personal, Habits, Reviews, Settings, Calendar, Semester, Analytics, Profile, and data tools accessible.
- Kept the dark-and-gold visual system.
- Changed only presentation, routing to the new More page, the service-worker cache version, and the manifest description.
- Did not change the application storage key, data schema, migration functions, or record-writing logic intentionally.

## Safety
This is a separate test package. It has not been deployed to GitHub Pages. Back up data from the live app before deployment, and test on the same origin so browser storage remains available. Never publish a personal JSON backup to a public repository.


## Daily-command refinement (requested follow-up)
- Home now features a visually prominent today's class schedule and today's gym/rest-day card, including the planned Upper/Lower session label when a training day is configured.
- Removed the old multi-row agenda list from the home layout and made the next commitment a compact summary.
- Reduced the Systems workspace from nine visible tab buttons to four primary destinations: Faith, Study, Physique, and Personal. Timetable, Phone, Habits, Reviews, and Settings remain accessible through one compact “More tools” selector.
- Reworked Profile memory timeline into one collapsible Memory Archive, with month folders and individual day folders. New memories remain filed by their saved date instead of accumulating as an endless open list.
- Bumped the service-worker cache name to refresh these interface assets on a future deployment. Storage key and data schema remain unchanged.
