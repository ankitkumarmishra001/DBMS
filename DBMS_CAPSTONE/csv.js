const crypto = require("crypto");
const GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function parse(text) {
  const rows = [];
  let row = [],
    cell = "",
    q = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r[0] || "").trim());
}

const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s));
const toInt = (v) =>
  Number.isFinite(+v) && String(v).trim() !== "" && +v >= 0
    ? Math.floor(+v)
    : 0;

// returns { rows, invalid, errors } ready for INSERT INTO donors (...) VALUES ?
function prepareDonors(text, maxRows = 5000) {
  const [header, ...data] = parse(text);
  if (!header) throw new Error("The file is empty.");
  const h = header.map((x) => x.trim().toLowerCase()),
    at = (n) => h.indexOf(n);
  const col = {
    name: at("name"),
    city: at("city"),
    group: at("blood_group"),
    phone: at("contact_number") >= 0 ? at("contact_number") : at("phone"),
  };
  const missing = [
    ["name", col.name],
    ["city", col.city],
    ["blood_group", col.group],
    ["contact_number", col.phone],
  ]
    .filter((x) => x[1] < 0)
    .map((x) => x[0]);
  if (missing.length)
    throw new Error("Missing column(s): " + missing.join(", "));
  if (data.length > maxRows)
    throw new Error(`Too many rows (limit ${maxRows}).`);
  const get = (r, n) => (at(n) >= 0 ? (r[at(n)] || "").trim() : "");
  const rows = [],
    errors = [];
  let invalid = 0;
  data.forEach((r, i) => {
    const name = (r[col.name] || "").trim(),
      city = (r[col.city] || "").trim(),
      group = (r[col.group] || "").trim(),
      phone = (r[col.phone] || "").trim(),
      code = get(r, "donor_id") || crypto.randomBytes(5).toString("hex"),
      avail = (get(r, "availability") || "Yes").toLowerCase();
    const why = !name
      ? "name is empty"
      : !city
        ? "city is empty"
        : !GROUPS.includes(group)
          ? `blood group "${group}" is not valid`
          : !/^\+?[0-9 ]{10,15}$/.test(phone)
            ? "phone must be 10 to 15 digits"
            : code.length > 10
              ? "donor_id is longer than 10 characters"
              : !["yes", "no"].includes(avail)
                ? "availability must be Yes or No"
                : "";
    if (why) {
      invalid++;
      errors.push(`Row ${i + 2}: ${why}`);
      return;
    }
    const created = get(r, "created_at");
    rows.push([
      code,
      name.slice(0, 80),
      get(r, "email").slice(0, 80),
      phone,
      city.slice(0, 50),
      group,
      avail === "yes" ? 1 : 0,
      toInt(get(r, "months_since_first_donation")),
      toInt(get(r, "number_of_donation")),
      toInt(get(r, "pints_donated")),
      validDate(created) ? created : new Date().toISOString().slice(0, 10),
    ]);
  });
  return { rows, invalid, errors };
}
module.exports = { parse, prepareDonors };
