// Constants shared with the UI, plus a small helper for calling the Express API.
const GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const COMPAT = {
  "A+": ["A+", "A-", "O+", "O-"],
  "A-": ["A-", "O-"],
  "B+": ["B+", "B-", "O+", "O-"],
  "B-": ["B-", "O-"],
  "AB+": GROUPS,
  "AB-": ["A-", "B-", "AB-", "O-"],
  "O+": ["O+", "O-"],
  "O-": ["O-"],
};
const MIN_GAP_DAYS = 90,
  LOW_STOCK = 2;
let token = null;
async function api(path, method = "GET", body) {
  const r = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: "Bearer " + token }),
    },
    body: body && JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && token) {
    token = null;
    me = null;
    say("Your session expired. Please sign in again.", 1);
    loginView();
  }
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}
