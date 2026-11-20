const fs = require("fs");
const COLS = [
  "donor_id",
  "name",
  "email",
  "password",
  "contact_number",
  "city",
  "blood_group",
  "availability",
  "months_since_first_donation",
  "number_of_donation",
  "pints_donated",
  "created_at",
];
const file = process.argv[2];
if (!file) {
  console.error("Usage: node csv-to-sql.js yourfile.csv");
  process.exit(1);
}

const { parse } = require("./csv");
const [header, ...data] = parse(fs.readFileSync(file, "utf8"));
const missing = COLS.filter((c) => !header.map((h) => h.trim()).includes(c));
if (missing.length) {
  console.error("Missing columns: " + missing.join(", "));
  process.exit(1);
}
const idx = Object.fromEntries(
  COLS.map((c) => [c, header.map((h) => h.trim()).indexOf(c)]),
);
const str = (v) =>
  "'" + String(v).trim().replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
const num = (v) => (Number.isFinite(+v) && v !== "" ? +v : "NULL");
const values = data.map(
  (r) =>
    `(${[
      str(r[idx.donor_id]),
      str(r[idx.name]),
      str(r[idx.email]),
      "NULL",
      str(r[idx.contact_number]),
      str(r[idx.city]),
      str(r[idx.blood_group]),
      str(r[idx.availability]),
      num(r[idx.months_since_first_donation]),
      num(r[idx.number_of_donation]),
      num(r[idx.pints_donated]),
      str(r[idx.created_at]),
    ].join(",")})`,
);

const sql = `USE bloodbank;
CREATE TABLE IF NOT EXISTS stg (donor_id CHAR(10), name VARCHAR(80), email VARCHAR(80), password VARCHAR(30),
  contact_number VARCHAR(20), city VARCHAR(50), blood_group VARCHAR(3), availability VARCHAR(3),
  months_since_first_donation INT, number_of_donation INT, pints_donated INT, created_at DATE);
TRUNCATE TABLE stg;
INSERT INTO stg (${COLS.join(",")}) VALUES
${values.join(",\n")};

-- add only donors that are not already in the database (matched on donor_id)
INSERT IGNORE INTO donors (donor_code, name, email, phone, city, blood_group, available,
                           months_since_first, total_donations, total_pints, registered_on)
SELECT donor_id, name, email, contact_number, city, blood_group, availability = 'Yes',
       months_since_first_donation, number_of_donation, pints_donated, created_at FROM stg;
DROP TABLE stg;
SELECT COUNT(*) AS donors_now FROM donors;
`;
fs.writeFileSync("load_stg_new.sql", sql);
console.log(`Wrote load_stg_new.sql with ${values.length} rows`);
