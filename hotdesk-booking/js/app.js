// ============================================================================
// Lukewarm Desk Booking System — front end (for Planckian's office)
// Data pipe is a Google Form (writes) + published Sheet CSV (reads).
// See config.js for the endpoints, README.md for setup.
// ============================================================================

const ROOMS = [
  {
    id: "A",
    name: "Room A",
    formRoom: "Room A", // exact value the Google Form's "Room" question expects
    elId: "desks-A",
    desks: [
      { id: "A1", label: "Desk 1", fixedOccupant: "Alessio" },
      { id: "A2", label: "Desk 2" },
      { id: "A3", label: "Desk 3" },
      { id: "A4", label: "Desk 4" },
    ],
  },
  {
    id: "B",
    name: "Room B",
    formRoom: "Room B",
    elId: "desks-B",
    desks: [
      { id: "B1", label: "Desk 1" },
      { id: "B2", label: "Desk 2" },
      { id: "B3", label: "Desk 3" },
      { id: "B4", label: "Desk 4" },
    ],
  },
  {
    id: "X",
    name: "Extra Spots",
    formRoom: "Extra",
    elId: "desks-X",
    desks: [
      { id: "X1", label: "Extra 1" },
      { id: "X2", label: "Extra 2" },
      { id: "X3", label: "Extra 3" },
    ],
  },
];

function formRoomForDesk(deskId) {
  const room = ROOMS.find((r) => r.desks.some((d) => d.id === deskId));
  return room ? room.formRoom : "";
}

// Add n business days to `base`, skipping Saturday/Sunday entirely — so from
// a Friday, +1 lands on Monday and +2 lands on Tuesday.
function addBusinessDays(base, n) {
  const d = new Date(base);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

// How many calendar days ahead the picker reaches (two weeks).
const HORIZON_CALENDAR_DAYS = 14;

// The selectable dates: "today" (who's actually in the office right now),
// then every business day out to HORIZON_CALENDAR_DAYS ahead (weekends
// skipped entirely) — so from a Friday, the first forward option is Monday.
function targetDateOptions() {
  const today = new Date();
  const options = [{ label: "today", date: today }];

  for (let n = 1; ; n++) {
    const date = addBusinessDays(today, n);
    const calendarDaysOut = Math.round((date - today) / 86400000);
    if (calendarDaysOut > HORIZON_CALENDAR_DAYS) break;
    const label = n === 1 ? "day after" : n === 2 ? "day after tomorrow" : null;
    options.push({ label, date });
  }
  return options;
}

const DEFAULT_OPTION_LABEL = "day after"; // which one is pre-selected on first load

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Reverse of isoDate() — built from local Y/M/D components so it doesn't
// shift a day when the browser is behind UTC (unlike `new Date(isoString)`).
function parseIsoLocal(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function friendlyDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Google's native "Date" question type is submitted as 3 separate fields
// (entry.<id>_year / _month / _day), not one plain value.
function dateFieldsForEntry(entryId, dateObj) {
  return {
    [`${entryId}_year`]: dateObj.getFullYear(),
    [`${entryId}_month`]: dateObj.getMonth() + 1,
    [`${entryId}_day`]: dateObj.getDate(),
  };
}

// The Sheet renders that native Date answer back as locale-formatted text
// (e.g. "4/9/2026") rather than ISO, so parse it defensively rather than
// comparing strings directly against our own ISO booking-date value.
function parseSheetDateToIso(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parts = s.split(/[\/.\-]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 3) {
    const nums = parts.map((p) => parseInt(p, 10));
    if (nums.every((n) => !isNaN(n))) {
      let year, month, day;
      if (String(parts[0]).length === 4) {
        [year, month, day] = nums; // Y-M-D
      } else {
        const [a, b, c] = nums;
        year = c < 100 ? 2000 + c : c;
        if (a > 12 && b <= 12) { day = a; month = b; }
        else if (b > 12 && a <= 12) { day = b; month = a; }
        else { day = a; month = b; } // ambiguous: assume D/M/Y (most locales)
      }
      if (year && month && day) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : isoDate(d);
}

function sameDate(rawCell, targetIso) {
  return parseSheetDateToIso(rawCell) === targetIso;
}

// ---- tiny CSV parser (handles quoted fields with commas/newlines) --------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        rows.push(row); row = [];
      } else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] || "").trim(); });
    return obj;
  });
}

// ---- cancel rows ------------------------------------------------------------
// A removal is written as a new row whose Name starts with CANCEL_PREFIX
// (e.g. "[cancelled] Guido"). That works with the form as it is; if the form
// ever gains an "Action" question (Book / Cancel) and ENTRY_IDS.action is set,
// it's filled in too and either marker counts.
const CANCEL_PREFIX = "[cancelled] ";

function isCancelRow(r) {
  return (r.Action || "").trim() === "Cancel" || (r.Name || "").startsWith(CANCEL_PREFIX);
}

// ---- pending (optimistic) bookings and cancellations ----------------------
// Both live in one localStorage list of { kind: "Book" | "Cancel", desk,
// when, date, name, ts, baseline }. `baseline` is how many Sheet rows (plus
// still-pending local entries) existed for that desk/date/slot when it was
// submitted; once the Sheet has more rows than that, our row has landed and
// the overlay is dropped. Matching on the exact slot matters: matching on
// desk+date alone dropped a new booking as soon as an older row (or the
// other half-day) was already there, so the desk looked free again.
const PENDING_KEY_V2 = "hotdesk_pending_v2";
const PENDING_MAX_AGE_MS = 10 * 60 * 1000; // a failed submit can't block a desk forever

function loadPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY_V2);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function savePending(list) {
  try { localStorage.setItem(PENDING_KEY_V2, JSON.stringify(list)); } catch {}
}
function addPending(entry) {
  const list = loadPending();
  list.push(entry);
  savePending(list);
}

function slotRows(rows, desk, when, date) {
  return rows.filter((r) => r.Desk === desk && r.When === when && sameDate(r.Date, date));
}

function prunePending(confirmedRows, forDate) {
  const list = loadPending().filter((p) => {
    if (p.date !== forDate) return true; // leave other days alone
    const landed = slotRows(confirmedRows, p.desk, p.when, p.date).length > p.baseline;
    const tooOld = Date.now() - p.ts > PENDING_MAX_AGE_MS;
    return !landed && !tooOld;
  });
  savePending(list);
}

// Baseline for a new local entry: rows already in the Sheet for that slot,
// plus local entries still waiting to land there ahead of it.
function pendingBaseline(rows, desk, when, date) {
  const queued = loadPending().filter((p) => p.desk === desk && p.when === when && p.date === date);
  return slotRows(rows, desk, when, date).length + queued.length;
}

// Drop the pre-v2 pending lists; their entries expire within 10 minutes anyway.
try {
  localStorage.removeItem("hotdesk_pending_bookings_v1");
  localStorage.removeItem("hotdesk_pending_cancels_v1");
} catch {}

// ---- data fetch ------------------------------------------------------------
async function fetchBookings() {
  const url = CONFIG.CSV_URL + (CONFIG.CSV_URL.includes("?") ? "&" : "?") + "_ts=" + Date.now();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

// ---- rendering -------------------------------------------------------------

// Who (if anyone) holds a given When-slot for a desk. The Sheet is an
// append-only event log (booking rows and cancel rows), so the MOST RECENT
// row for a slot is authoritative. Local pending entries are by construction
// newer than every Sheet row (they're pruned once they land), so the newest
// of those wins over the Sheet — a remove followed by a quick re-book shows
// the re-booking, not a free desk.
function slotOccupant(deskRows, deskPending, slotName) {
  const local = deskPending.filter((p) => p.when === slotName);
  const lastLocal = local[local.length - 1];
  if (lastLocal) {
    return lastLocal.kind === "Cancel" ? null : { name: lastLocal.name, pending: true };
  }

  const matching = deskRows.filter((r) => r.When === slotName);
  const last = matching[matching.length - 1];
  if (last && !isCancelRow(last)) return { name: last.Name, pending: false };
  return null;
}

// Whole day / Morning / Afternoon occupants for one desk on one date.
function deskState(rows, pending, deskId, forDate) {
  const deskRows = rows.filter((r) => r.Desk === deskId && sameDate(r.Date, forDate));
  const deskPending = pending.filter((p) => p.desk === deskId && p.date === forDate);
  return {
    wholeDay: slotOccupant(deskRows, deskPending, "Whole day"),
    morning: slotOccupant(deskRows, deskPending, "Morning"),
    afternoon: slotOccupant(deskRows, deskPending, "Afternoon"),
  };
}

// Whoever already holds something that a new `when` booking would overlap.
function conflictFor(state, when) {
  if (state.wholeDay) return state.wholeDay;
  if (when === "Whole day") return state.morning || state.afternoon;
  return when === "Morning" ? state.morning : state.afternoon;
}

function removeButtonHtml(desk, slotName, occupant) {
  if (occupant.pending) return ""; // nothing confirmed in the Sheet yet to remove
  return `<button class="remove-btn" title="Remove this booking"
    data-desk="${desk.id}" data-label="${escapeHtml(desk.label)}"
    data-slot="${slotName}" data-name="${escapeHtml(occupant.name)}">✕</button>`;
}

function renderHalf(desk, slotName, occupant) {
  if (occupant) {
    return `
      <div class="half booked${occupant.pending ? " pending" : ""}">
        <span class="half-name">${slotName}${occupant.pending ? " · booking…" : ""}</span>
        <span class="who">${escapeHtml(occupant.name)} ${removeButtonHtml(desk, slotName, occupant)}</span>
      </div>
    `;
  }
  return `
    <div class="half free">
      <span class="half-name">${slotName} · free</span>
      <button class="mini-book-btn" data-desk="${desk.id}" data-label="${desk.label}" data-slot="${slotName}">Book</button>
    </div>
  `;
}

function render(rows, forDate) {
  const pending = loadPending();

  for (const room of ROOMS) {
    const container = document.getElementById(room.elId);
    container.innerHTML = "";
    for (const desk of room.desks) {
      const card = document.createElement("div");
      card.className = "desk-card";

      if (desk.fixedOccupant) {
        card.classList.add("fixed");
        card.innerHTML = `
          <span class="desk-label">${desk.label}</span>
          <span class="pill fixed">Always occupied</span>
          <div class="desk-occupant"><span class="who">${desk.fixedOccupant}</span></div>
        `;
        container.appendChild(card);
        continue;
      }

      const { wholeDay, morning, afternoon } = deskState(rows, pending, desk.id, forDate);

      if (wholeDay) {
        // A whole-day booking (confirmed or pending) occupies both halves —
        // show one solid booked card, same as before half-splitting existed.
        card.classList.add("booked");
        if (wholeDay.pending) card.classList.add("pending");
        card.innerHTML = `
          <span class="desk-label">${desk.label}</span>
          <span class="pill booked">${wholeDay.pending ? "Booking…" : "Booked"}</span>
          <div class="desk-occupant">
            <span class="who">${escapeHtml(wholeDay.name)}</span>
            <span class="when">Whole day</span>
            ${removeButtonHtml(desk, "Whole day", wholeDay)}
          </div>
        `;
      } else if (!morning && !afternoon) {
        card.classList.add("free");
        card.innerHTML = `
          <span class="desk-label">${desk.label}</span>
          <span class="pill free">Free</span>
          <button class="book-btn" data-desk="${desk.id}" data-label="${desk.label}">Book</button>
        `;
      } else {
        // Exactly one half taken — split the card so the other half stays
        // independently bookable.
        card.classList.add("split");
        card.innerHTML = `
          <span class="desk-label">${desk.label}</span>
          ${renderHalf(desk, "Morning", morning)}
          ${renderHalf(desk, "Afternoon", afternoon)}
        `;
      }
      container.appendChild(card);
    }
  }

  document.querySelectorAll(".book-btn").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.desk, btn.dataset.label));
  });
  document.querySelectorAll(".mini-book-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      openModalForSlot(btn.dataset.desk, btn.dataset.label, btn.dataset.slot)
    );
  });
  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      openRemoveModal(btn.dataset.desk, btn.dataset.label, btn.dataset.slot, btn.dataset.name)
    );
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---- booking submission (hidden-iframe POST to the Google Form) ----------
function submitToGoogleForm(fields) {
  return new Promise((resolve) => {
    const iframeName = "hidden_submit_" + Date.now();
    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const form = document.createElement("form");
    form.action = CONFIG.FORM_ACTION_URL;
    form.method = "POST";
    form.target = iframeName;
    form.style.display = "none";

    for (const [key, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      form.remove();
      iframe.remove();
      resolve();
    }, 800);
  });
}

// One Book or Cancel row. The Action field is only sent once the form really
// has that question; a cancel is always marked via the Name prefix as well.
function submitFormRow(desk, when, isoDay, name, action) {
  const fields = {
    [CONFIG.ENTRY_IDS.name]: action === "Cancel" ? CANCEL_PREFIX + name : name,
    [CONFIG.ENTRY_IDS.desk]: desk,
    [CONFIG.ENTRY_IDS.room]: formRoomForDesk(desk),
    [CONFIG.ENTRY_IDS.when]: when,
    ...dateFieldsForEntry(CONFIG.ENTRY_IDS.date, parseIsoLocal(isoDay)),
  };
  if (CONFIG.ENTRY_IDS.action) fields[CONFIG.ENTRY_IDS.action] = action;
  return submitToGoogleForm(fields);
}

// ---- modal -----------------------------------------------------------------
let activeDesk = null;
let presetWhen = null; // set when booking a single free half of a split desk

function openModalCommon(deskId, deskLabel) {
  activeDesk = deskId;
  const forDateObj = parseIsoLocal(getSelectedDateIso());
  document.getElementById("modalTitle").textContent = `Book ${deskLabel} — ${friendlyDate(forDateObj)}`;
  document.getElementById("nameInput").value = "";
  document.getElementById("modalError").textContent = "";
  document.getElementById("modalBackdrop").classList.add("open");
  document.getElementById("nameInput").focus();
}

// Whole desk is free: let the visitor choose Morning / Afternoon / Whole day.
function openModal(deskId, deskLabel) {
  presetWhen = null;
  openModalCommon(deskId, deskLabel);
  document.getElementById("whenField").hidden = false;
  document.getElementById("whenInput").value = "";
  document.getElementById("whenPreset").hidden = true;
}

// Only one half of the desk is free: skip the choice, lock it to that half.
function openModalForSlot(deskId, deskLabel, slotName) {
  presetWhen = slotName;
  openModalCommon(deskId, deskLabel);
  document.getElementById("whenField").hidden = true;
  const presetEl = document.getElementById("whenPreset");
  presetEl.innerHTML = `When: <strong>${escapeHtml(slotName)}</strong> (the other half of this desk is already booked)`;
  presetEl.hidden = false;
}

function closeModal() {
  activeDesk = null;
  presetWhen = null;
  document.getElementById("modalBackdrop").classList.remove("open");
}

async function confirmBooking() {
  const name = document.getElementById("nameInput").value.trim();
  const when = presetWhen || document.getElementById("whenInput").value;
  const errEl = document.getElementById("modalError");

  if (!name) { errEl.textContent = "Please enter your name."; return; }
  if (!when) { errEl.textContent = "Please select Morning, Afternoon or Whole day."; return; }

  const forDate = getSelectedDateIso();
  const confirmBtn = document.getElementById("confirmBtn");
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Booking…";

  try {
    // Re-read the Sheet first: the board may be up to a minute old, and
    // booking over someone who just took the desk is how double-bookings
    // happened.
    const rows = await fetchBookings();
    prunePending(rows, forDate);
    const taken = conflictFor(deskState(rows, loadPending(), activeDesk, forDate), when);
    if (taken) {
      errEl.textContent = `Sorry — ${taken.name} has just booked this desk. The board has been refreshed.`;
      render(rows, forDate);
      return;
    }

    const baseline = pendingBaseline(rows, activeDesk, when, forDate);
    await submitFormRow(activeDesk, when, forDate, name, "Book");
    addPending({ kind: "Book", desk: activeDesk, name, when, date: forDate, ts: Date.now(), baseline });
    closeModal();
    setStatus("Booking sent — refreshing…");
    await refresh();
  } catch (e) {
    errEl.textContent = "Something went wrong sending the booking. Try again.";
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Book it";
  }
}

// ---- remove (cancel) flow: two-stage confirmation --------------------------
let removeTarget = null; // { desk, deskLabel, when, name }
let removeStage = 0;     // 0 = closed, 1 = first warning, 2 = second warning

function openRemoveModal(desk, deskLabel, when, name) {
  removeTarget = { desk, deskLabel, when, name };
  removeStage = 1;
  document.getElementById("removeModalError").textContent = "";
  document.getElementById("removeModalBackdrop").classList.add("open");
  renderRemoveStage();
}

function renderRemoveStage() {
  const { deskLabel, when, name } = removeTarget;
  const title = document.getElementById("removeModalTitle");
  const body = document.getElementById("removeModalBody");
  const confirmBtn = document.getElementById("removeConfirmBtn");

  if (removeStage === 1) {
    title.textContent = "Remove booking?";
    body.innerHTML = `Remove <strong>${escapeHtml(name)}</strong>'s <strong>${escapeHtml(when)}</strong> booking on <strong>${escapeHtml(deskLabel)}</strong>?`;
    confirmBtn.textContent = "Remove";
  } else {
    title.textContent = "Wait, really?";
    body.innerHTML = `Sure sure it's you, <strong>${escapeHtml(name)}</strong>? 😊 This can't be undone.`;
    confirmBtn.textContent = "Yes, it's me — remove it";
  }
}

function closeRemoveModal() {
  removeTarget = null;
  removeStage = 0;
  document.getElementById("removeModalBackdrop").classList.remove("open");
}

async function confirmRemove() {
  if (removeStage === 1) {
    removeStage = 2;
    renderRemoveStage();
    return;
  }

  const { desk, when, name } = removeTarget;
  const forDate = getSelectedDateIso();
  const errEl = document.getElementById("removeModalError");
  const confirmBtn = document.getElementById("removeConfirmBtn");
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Removing…";

  try {
    // Only cancel if that booking is still the one holding the slot —
    // otherwise a stale board could cancel someone else's newer booking.
    const rows = await fetchBookings();
    prunePending(rows, forDate);
    const state = deskState(rows, loadPending(), desk, forDate);
    const holder = { "Whole day": state.wholeDay, Morning: state.morning, Afternoon: state.afternoon }[when];
    if (!holder || holder.name !== name) {
      closeRemoveModal();
      setStatus("That booking had already changed — board refreshed.");
      render(rows, forDate);
      return;
    }

    const baseline = pendingBaseline(rows, desk, when, forDate);
    await submitFormRow(desk, when, forDate, name, "Cancel");
    addPending({ kind: "Cancel", desk, name, when, date: forDate, ts: Date.now(), baseline });
    closeRemoveModal();
    setStatus("Removal sent — refreshing…");
    await refresh();
  } catch (e) {
    errEl.textContent = "Something went wrong removing the booking. Try again.";
  } finally {
    confirmBtn.disabled = false;
    if (removeStage === 2) confirmBtn.textContent = "Yes, it's me — remove it";
  }
}

function setStatus(msg) {
  document.getElementById("statusMsg").textContent = msg;
}

// ---- date picker (today / day after / day after tomorrow) ------------------
// Repopulates the <select>, keeping whatever the visitor currently has
// picked if it's still one of the valid options (it will be, in almost all
// cases — options only shift at midnight). On first load (no prior
// selection), defaults to DEFAULT_OPTION_LABEL rather than "today".
function populateDateSelect() {
  const sel = document.getElementById("targetDateSelect");
  const prevValue = sel.value;
  const options = targetDateOptions();

  sel.innerHTML = "";
  for (const opt of options) {
    const iso = isoDate(opt.date);
    const el = document.createElement("option");
    el.value = iso;
    el.dataset.label = opt.label || "";
    el.textContent = opt.label ? `${friendlyDate(opt.date)} (${opt.label})` : friendlyDate(opt.date);
    sel.appendChild(el);
  }

  const stillValid = Array.from(sel.options).some((o) => o.value === prevValue);
  if (stillValid) {
    sel.value = prevValue;
  } else {
    const defaultOpt = Array.from(sel.options).find((o) => o.dataset.label === DEFAULT_OPTION_LABEL);
    sel.value = (defaultOpt || sel.options[0]).value;
  }
}

function getSelectedDateIso() {
  const sel = document.getElementById("targetDateSelect");
  if (!sel.value) populateDateSelect();
  return sel.value;
}

// ---- main refresh loop ------------------------------------------------------
async function refresh() {
  populateDateSelect(); // keep options current (e.g. across a midnight rollover)
  const forDate = getSelectedDateIso();
  setStatus("Loading bookings…");
  try {
    const rows = await fetchBookings();
    prunePending(rows, forDate);
    render(rows, forDate);
    setStatus("Up to date · " + new Date().toLocaleTimeString());
  } catch (e) {
    console.error(e);
    render([], forDate); // still show the board with local pending state
    setStatus("Couldn't load the shared sheet (check config.js). Showing local state only.");
  }
}

function init() {
  populateDateSelect();
  document.getElementById("targetDateSelect").addEventListener("change", refresh);

  document.getElementById("refreshBtn").addEventListener("click", refresh);
  document.getElementById("cancelBtn").addEventListener("click", closeModal);
  document.getElementById("confirmBtn").addEventListener("click", confirmBooking);
  document.getElementById("modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });

  document.getElementById("removeCancelBtn").addEventListener("click", closeRemoveModal);
  document.getElementById("removeConfirmBtn").addEventListener("click", confirmRemove);
  document.getElementById("removeModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "removeModalBackdrop") closeRemoveModal();
  });

  refresh();
  setInterval(refresh, CONFIG.POLL_INTERVAL_MS || 60000);
}

document.addEventListener("DOMContentLoaded", init);
