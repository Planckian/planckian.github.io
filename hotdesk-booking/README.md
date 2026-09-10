# Lukewarm Desk Booking System

A tiny standalone static site to see and book hot desks — **today**, and any
business day up to **two weeks ahead** (weekends never appear as an option).
Room A (4 desks, desk 1 permanently held by Alessio), Room B (4 desks), and 3
overflow "extra" spots.

The page is the only thing people interact with. Behind the scenes it uses a
Google Form as the write path and a published Google Sheet (as CSV) as the read
path — no server, no third-party account beyond Google, free.

## ⚠ One setup step still needed: the "Action" question

The form needs a 6th question added before booking removal will work:

- **Type:** Multiple choice
- **Title:** exactly `Action`
- **Options:** `Book` and `Cancel`
- **Required:** no

This powers the "remove a booking" feature (see Notes below) — removing a
name doesn't delete anything from the Sheet, it adds a new row with
`Action = Cancel`, and the site treats the *most recent* row for a given
desk/date/slot as the current truth. Until this question exists, attempting
to remove a booking will submit but silently do nothing (the field name sent
won't match any question on Google's end).

Add it, then tell me (or paste the form's `viewform` link again) and I'll
grab its real entry ID and finish wiring `js/config.js`.

## 1. The Google Form (already set up, except Action above)

The form ("Booking a table" / "these desks are hot") has 5 questions already:
`Name` (short answer), `When` (multiple choice: Morning / Afternoon / Whole
day), `Room` (multiple choice: Room A / Room B / Extra), `Date` (native date
question), `Desk` (short answer, free text like `A2`, `B3`, `X1`) — plus the
`Action` question described above. Nobody fills this form in directly — the
site submits to it silently in the background.

`js/config.js` already has the real `FORM_ACTION_URL` and the first 5
`ENTRY_IDS` wired in; `ENTRY_IDS.action` is still a placeholder until the
question above exists. If the form's questions are ever rebuilt from
scratch, all the entry IDs will change — get new ones by opening the form's
`viewform` URL, running `JSON.stringify(window.FB_PUBLIC_LOAD_DATA_)` in the
browser console, and reading off each question's id from that structure (or
send me the link and I'll do it).

## 2. The response Sheet (already set up)

The response Sheet's current sharing setting already allows link-based
access, so `js/config.js` reads it directly via Google's CSV export endpoint:

```
https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv
```

No "Publish to web" step needed *as long as that sharing stays as-is*. If
someone later tightens the Sheet's sharing (e.g. restricts it to specific
people), this export URL will start failing — in that case, use
**File → Share → Publish to web** on the Sheet instead (pick the response
tab, format CSV, Publish) and swap the resulting `.../pub?output=csv` URL
into `CSV_URL`.

Setup is otherwise complete — done by whoever owns the Google account this
lives under (a shared/company account is best so it isn't tied to one
person).

## 3. Deploy to GitHub Pages

1. Push this folder as a new repo (or into an existing one) on GitHub.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → branch
   `main`, folder `/ (root)` → Save.
3. GitHub gives you a URL like `https://<org>.github.io/<repo>/` — share that
   with the office.

## Notes / limitations

- **Booking date is a picker, not fixed.** A dropdown at the top lists
  **today** plus every business day out to **two weeks ahead**
  (`HORIZON_CALENDAR_DAYS` in `js/app.js`) — weekends never appear as an
  option, so a Friday's next entry is Monday. Defaults to "day after" on
  first load. Computed fresh in the visitor's browser on every load/refresh;
  no daily reset needed. See `targetDateOptions()` / `addBusinessDays()` /
  `HORIZON_CALENDAR_DAYS` / `DEFAULT_OPTION_LABEL` in `js/app.js` to change
  the horizon or the default.
- **Alessio's desk (Room A, Desk 1)** is hard-coded in `js/app.js` — it never
  reads from the sheet and can't be booked through the UI. Edit the
  `fixedOccupant` field there if this ever changes.
- **Half-day splitting.** If a desk is booked for only "Morning" or only
  "Afternoon", its card splits in two — the booked half shows the occupant,
  the free half gets its own small "Book" button that locks straight to that
  half (no Morning/Afternoon/Whole day choice needed, since only one option
  is actually free). A "Whole day" booking always occupies both halves, same
  as before splitting existed.
- **Update lag:** Google's "Publish to web" CSV can take up to a minute or two
  to reflect a brand-new form response for *other* visitors. The person who
  just booked sees their own booking immediately (optimistic local state);
  everyone else sees it once the Sheet republishes and the page's periodic
  refresh (default: every 60s) picks it up.
- **No login, no double-booking lock.** This is meant for a small, trusted
  office. Two people booking the same desk within the same refresh window is
  possible in theory; if it happens, sort it out in person (or edit the Sheet
  by hand to remove the duplicate row).
- **Removing a booking** is exposed as a small ✕ next to any booked name
  (not shown for pending/unconfirmed bookings, and not for Alessio's fixed
  desk). Clicking it needs **two confirmations** in a row — "Remove
  booking?" then "Sure sure it's you, *Name*? 😊 This can't be undone." —
  before anything is submitted. Under the hood this doesn't delete the
  Sheet row (the site has no write access beyond the Form); it appends a
  new row for that same desk/date/slot with `Action = Cancel`. The site
  always reads the *most recent* row per desk/date/slot as authoritative,
  so a Cancel row after a Book row frees the slot again (`slotOccupant()` in
  `js/app.js`). This means the Sheet keeps a full history rather than a
  clean current-state table — that's expected, not a bug.
- **Date column parsing:** the `Date` question is Google's native date-picker
  type, so the Sheet shows it as locale-formatted text (e.g. `4/9/2026`)
  rather than ISO. The site parses this defensively (`parseSheetDateToIso` in
  `js/app.js`) and assumes day-before-month when a date is ambiguous (e.g.
  `4/9`), which matches most locales outside the US. If desks ever seem to
  show up on the wrong day, check the Sheet's actual date format and adjust
  that function.
- All styling is plain CSS in `css/style.css`, no build step, no dependencies.
