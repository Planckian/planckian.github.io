// ============================================================================
// Lukewarm Desk Booking System — wired up to the live "Booking a table" /
// "these desks are hot" form + its linked response Sheet.
//
// Removing a booking appends a row whose Name is "[cancelled] <name>", so it
// works with the form's five existing questions. An optional "Action"
// question (multiple choice: Book / Cancel) can be added later; put its
// entry.NNNNNN id in ENTRY_IDS.action and the site fills it in as well.
// ============================================================================
const CONFIG = {
  // The Google Form's submit endpoint (…/viewform with "formResponse" swapped in).
  FORM_ACTION_URL:
    "https://docs.google.com/forms/d/e/1FAIpQLScmIgwOsTnO03e4OCYN229s9X8qblQgxal1kfUE8mRptwzmjw/formResponse",

  // Entry IDs, one per form question (verified against the live form's schema).
  ENTRY_IDS: {
    name: "entry.631548922",   // "Name" (short answer)
    when: "entry.1000001",    // "When" (Morning / Afternoon / Whole day)
    room: "entry.67862874",   // "Room" (Room A / Room B / Extra)
    desk: "entry.1000000",    // "Desk " (free text, e.g. A2, B3, X1)
    date: "entry.1649304243", // "Date" (native date question — site expands
                               // this into _year/_month/_day fields itself,
                               // see dateFieldsForEntry() in app.js)
    action: null,             // optional "Action" (Book / Cancel) question —
                               // not on the form; see the note above.
  },

  // CSV export of the response Sheet (works because the Sheet's current
  // sharing setting already allows link-based access — confirmed reachable
  // without login). If sharing is ever tightened, use "Publish to web"
  // instead (File -> Share -> Publish to web -> CSV) and swap the URL here.
  CSV_URL: "https://docs.google.com/spreadsheets/d/1ZRmBR2kAVtP_SS3vuWloL89y5ro4NmToU4FKYbIJta8/export?format=csv",

  // How often to auto-refresh the board from the sheet, in milliseconds.
  POLL_INTERVAL_MS: 60000,
};
