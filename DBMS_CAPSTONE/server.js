const express = require("express"),
  bcrypt = require("bcryptjs"),
  jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./db"),
  { jwtSecret, port } = require("./config"),
  { prepareDonors } = require("./csv");
const crypto = require("crypto");
const app = express();
app.use(express.json({ limit: "5mb" }), express.static(path.join(__dirname, "public")));

if (!jwtSecret) {
  console.warn("WARNING: Set JWT_SECRET in your deployment environment before using authentication.");
}

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

const wrap = (f) => (req, res) =>
  f(req, res).catch((e) =>
    res.status(400).json({
      error:
        e.errno === 1062
          ? "That username is already taken."
          : e.errno === 1451
            ? "This donor has records or a login, so they can't be removed."
            : e.sqlMessage || e.message,
    }),
  );
const auth = (req, res, next) => {
  try {
    req.u = jwt.verify((req.headers.authorization || "").slice(7), jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: "Please sign in." });
  }
};
const admin = (req, res, next) =>
  req.u.role === "admin"
    ? next()
    : res.status(403).json({ error: "Admins only." });
const stockMap = async (c = db) => {
  const [rows] = await c.query("SELECT blood_group, units FROM stock");
  return Object.fromEntries(rows.map((r) => [r.blood_group, r.units]));
};
const DONOR_COLS =
  "id, name, blood_group AS `group`, phone, city, available, wait_days";
const REQ_COLS =
  "id, hospital, blood_group AS `group`, units, requested_on AS date, status, urgent";
const asReq = (r) => ({ ...r, urgent: !!r.urgent, available: undefined });

// public numbers for the login page
app.get(
  "/api/public",
  wrap(async (req, res) => {
    const [[{ n }]] = await db.query("SELECT COUNT(*) n FROM donors");
    const s = await stockMap();
    res.json({
      donors: n,
      units: Object.values(s).reduce((a, b) => a + Math.max(0, b), 0),
    });
  }),
);

// public sign-up: creates the donor record and their login together, or neither
app.post(
  "/api/register",
  wrap(async (req, res) => {
    const {
      name,
      group,
      city,
      phone,
      email = "",
      username,
      password,
    } = req.body;
    if (!name?.trim() || !city?.trim() || !GROUPS.includes(group))
      throw new Error("Check your name, city and blood group.");
    if (!/^\+?[0-9 ]{10,15}$/.test(phone || ""))
      throw new Error("Phone must be 10 to 15 digits.");
    if (email && !/^\S+@\S+\.\S+$/.test(email))
      throw new Error("That email address does not look right.");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username || ""))
      throw new Error(
        "Username must be 3 to 20 letters, numbers or underscores.",
      );
    if (typeof password !== "string" || password.length < 8)
      throw new Error("Password must be at least 8 characters.");
    const hash = await bcrypt.hash(password, 10),
      c = await db.getConnection();
    try {
      await c.beginTransaction();
      const [[taken]] = await c.query(
        "SELECT 1 AS x FROM users WHERE username = ?",
        [username],
      );
      if (taken) throw new Error("That username is already taken.");
      const [d] = await c.query(
        `INSERT INTO donors (donor_code, name, email, phone, city, blood_group, available, registered_on)
      VALUES (?,?,?,?,?,?,1,CURDATE())`,
        [
          crypto.randomBytes(5).toString("hex"),
          name.trim().slice(0, 80),
          email.trim().slice(0, 80),
          phone,
          city.trim().slice(0, 50),
          group,
        ],
      );
      // role is always 'donor' here; it is never read from the request
      await c.query(
        `INSERT INTO users (username, password_hash, role, name, donor_id) VALUES (?, ?, 'donor', ?, ?)`,
        [username, hash, name.trim().slice(0, 80), d.insertId],
      );
      await c.commit();
      const user = { name: name.trim(), role: "donor", donorId: d.insertId };
      res.json({ token: jwt.sign(user, jwtSecret, { expiresIn: "8h" }), user });
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }),
);

app.post(
  "/api/login",
  wrap(async (req, res) => {
    const [[u]] = await db.query("SELECT * FROM users WHERE username = ?", [
      req.body.username,
    ]);
    if (!u || !(await bcrypt.compare(req.body.password || "", u.password_hash)))
      return res
        .status(401)
        .json({ error: "Username or password is incorrect." });
    const user = { name: u.name, role: u.role, donorId: u.donor_id };
    res.json({ token: jwt.sign(user, jwtSecret, { expiresIn: "8h" }), user });
  }),
);

app.get(
  "/api/summary",
  auth,
  admin,
  wrap(async (req, res) => {
    const [[{ donors }]] = await db.query("SELECT COUNT(*) donors FROM donors");
    const [[{ eligible }]] = await db.query(
      "SELECT COUNT(*) eligible FROM donor_status WHERE available = 1 AND wait_days = 0",
    );
    const [pendingList] = await db.query(
      `SELECT ${REQ_COLS} FROM requests WHERE status = 'Pending' ORDER BY urgent DESC, id`,
    );
    const [recent] =
      await db.query(`SELECT n.donated_on AS date, d.name, d.blood_group AS \`group\`, n.units
    FROM donations n JOIN donors d ON d.id = n.donor_id ORDER BY n.donated_on DESC, n.id DESC LIMIT 5`);
    res.json({
      donors,
      eligible,
      stock: await stockMap(),
      pendingList: pendingList.map(asReq),
      recent,
    });
  }),
);

app.get(
  "/api/donors",
  auth,
  admin,
  wrap(async (req, res) => {
    const { q = "", group = "All", page = 1 } = req.query,
      limit = Math.min(+req.query.limit || 25, 50);
    const where = `WHERE (name LIKE ? OR city LIKE ? OR blood_group = ?) AND (? = 'All' OR blood_group = ?)`;
    const p = [`%${q}%`, `%${q}%`, q, group, group];
    const [[{ n }]] = await db.query(
      `SELECT COUNT(*) n FROM donor_status ${where}`,
      p,
    );
    const [rows] = await db.query(
      `SELECT ${DONOR_COLS} FROM donor_status ${where} ORDER BY name LIMIT ? OFFSET ?`,
      [...p, limit, (Math.max(1, +page) - 1) * limit],
    );
    res.json({ rows, total: n });
  }),
);

app.post(
  "/api/donors",
  auth,
  admin,
  wrap(async (req, res) => {
    const { name, group, city, phone, available } = req.body;
    if (
      !name ||
      !city ||
      !GROUPS.includes(group) ||
      !/^\+?[0-9 ]{10,15}$/.test(phone || "")
    )
      throw new Error("Check the name, city, blood group and phone number.");
    await db.query(
      `INSERT INTO donors (donor_code, name, email, phone, city, blood_group, available, registered_on)
    VALUES (LEFT(UUID(), 10), ?, '', ?, ?, ?, ?, CURDATE())`,
      [name, phone, city, group, !!available],
    );
    res.json({ ok: 1 });
  }),
);

// admin uploads a donor CSV; rows are validated here, then inserted in one transaction
app.post(
  "/api/donors/import",
  auth,
  admin,
  wrap(async (req, res) => {
    const { rows, invalid, errors } = prepareDonors(String(req.body.csv || ""));
    if (!rows.length)
      throw new Error(errors[0] || "No valid rows found in this file.");
    const c = await db.getConnection();
    let added = 0;
    try {
      await c.beginTransaction();
      for (let i = 0; i < rows.length; i += 500) {
        // INSERT IGNORE skips donors whose donor_id already exists
        const [r] = await c.query(
          `INSERT IGNORE INTO donors (donor_code, name, email, phone, city, blood_group, available,
        months_since_first, total_donations, total_pints, registered_on) VALUES ?`,
          [rows.slice(i, i + 500)],
        );
        added += r.affectedRows;
      }
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
    res.json({
      added,
      skipped: rows.length - added,
      invalid,
      errors: errors.slice(0, 5),
    });
  }),
);

app.delete(
  "/api/donors/:id",
  auth,
  admin,
  wrap(async (req, res) => {
    await db.query("DELETE FROM donors WHERE id = ?", [req.params.id]);
    res.json({ ok: 1 });
  }),
);

app.get(
  "/api/donations",
  auth,
  admin,
  wrap(async (req, res) => {
    const [rows] =
      await db.query(`SELECT n.donated_on AS date, d.name, d.blood_group AS \`group\`, n.units
    FROM donations n JOIN donors d ON d.id = n.donor_id ORDER BY n.donated_on DESC, n.id DESC LIMIT 30`);
    res.json({ rows });
  }),
);

// the trigger in schema.sql rejects unavailable donors and the 90-day rule
app.post(
  "/api/donations",
  auth,
  admin,
  wrap(async (req, res) => {
    await db.query(
      "INSERT INTO donations (donor_id, donated_on, units) VALUES (?, CURDATE(), ?)",
      [req.body.donorId, req.body.units],
    );
    res.json({ ok: 1 });
  }),
);

app.get(
  "/api/requests",
  auth,
  admin,
  wrap(async (req, res) => {
    const st = req.query.status || "All";
    const [rows] = await db.query(
      `SELECT ${REQ_COLS} FROM requests WHERE (? = 'All' OR status = ?) ORDER BY id DESC LIMIT 200`,
      [st, st],
    );
    res.json({ rows: rows.map(asReq) });
  }),
);

app.post(
  "/api/requests",
  auth,
  admin,
  wrap(async (req, res) => {
    const { hospital, group, units, urgent } = req.body;
    if (!hospital || !GROUPS.includes(group))
      throw new Error("Check the hospital and blood group.");
    await db.query(
      "INSERT INTO requests (hospital, blood_group, units, requested_on, urgent) VALUES (?,?,?,CURDATE(),?)",
      [hospital, group, units, !!urgent],
    );
    res.json({ ok: 1 });
  }),
);

// fulfil/reject inside a transaction so two admins can't use the same stock twice
app.patch(
  "/api/requests/:id",
  auth,
  admin,
  wrap(async (req, res) => {
    const st = req.body.status;
    if (!["Fulfilled", "Rejected"].includes(st))
      throw new Error("Invalid status.");
    const c = await db.getConnection();
    try {
      await c.beginTransaction();
      const [[r]] = await c.query(
        "SELECT * FROM requests WHERE id = ? AND status = 'Pending' FOR UPDATE",
        [req.params.id],
      );
      if (!r) throw new Error("This request is no longer pending.");
      if (st === "Fulfilled") {
        const s = await stockMap(c),
          have = Math.max(0, s[r.blood_group]);
        if (have < r.units) {
          const alt = COMPAT[r.blood_group]
            .filter((g) => g !== r.blood_group && s[g] > 0)
            .map((g) => `${g} (${s[g]})`);
          throw new Error(
            `Not enough ${r.blood_group}: ${have} in stock, ${r.units} needed.` +
              (alt.length
                ? ` Compatible groups in stock: ${alt.join(", ")}.`
                : ""),
          );
        }
      }
      await c.query("UPDATE requests SET status = ? WHERE id = ?", [st, r.id]);
      await c.commit();
      res.json({ ok: 1 });
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }),
);

app.get(
  "/api/reports",
  auth,
  admin,
  wrap(async (req, res) => {
    const [[{ eligible }]] = await db.query(
      "SELECT COUNT(*) eligible FROM donor_status WHERE available = 1 AND wait_days = 0",
    );
    const [list] = await db.query(
      `SELECT ${DONOR_COLS} FROM donor_status WHERE available = 1 AND wait_days = 0 ORDER BY name LIMIT 25`,
    );
    const [lifetime] =
      await db.query(`SELECT blood_group AS \`group\`, COUNT(*) donors, CAST(SUM(total_donations) AS SIGNED) donations,
    CAST(SUM(total_pints) AS SIGNED) pints FROM donors GROUP BY blood_group ORDER BY blood_group`);
    const [cities] =
      await db.query(`SELECT city, COUNT(*) donors, CAST(SUM(available) AS SIGNED) available
    FROM donors GROUP BY city ORDER BY donors DESC`);
    res.json({ stock: await stockMap(), eligible, list, lifetime, cities });
  }),
);

// donation centres: any signed-in user can read, only admins change them
app.get(
  "/api/centers",
  auth,
  wrap(async (req, res) => {
    const [rows] = await db.query(
      "SELECT id, name, city, address, phone, hours FROM centers ORDER BY city, name",
    );
    res.json({ rows });
  }),
);
app.post(
  "/api/centers",
  auth,
  admin,
  wrap(async (req, res) => {
    const { name, city, address, phone, hours } = req.body;
    if (![name, city, address, hours].every((x) => x && x.trim()))
      throw new Error("Fill in the name, city, address and opening hours.");
    if (!/^\+?[0-9 ]{10,15}$/.test(phone || ""))
      throw new Error("Phone must be 10 to 15 digits.");
    await db.query(
      "INSERT INTO centers (name, city, address, phone, hours) VALUES (?,?,?,?,?)",
      [
        name.trim().slice(0, 80),
        city.trim().slice(0, 50),
        address.trim().slice(0, 120),
        phone,
        hours.trim().slice(0, 80),
      ],
    );
    res.json({ ok: 1 });
  }),
);
app.delete(
  "/api/centers/:id",
  auth,
  admin,
  wrap(async (req, res) => {
    await db.query("DELETE FROM centers WHERE id = ?", [req.params.id]);
    res.json({ ok: 1 });
  }),
);

app.get(
  "/api/me",
  auth,
  wrap(async (req, res) => {
    if (!req.u.donorId) throw new Error("No donor profile for this account.");
    const [[donor]] = await db.query(
      `SELECT name, blood_group AS \`group\`, city, phone, available, wait_days,
    total_donations, total_pints FROM donor_status WHERE id = ?`,
      [req.u.donorId],
    );
    const [history] = await db.query(
      "SELECT donated_on AS date, units FROM donations WHERE donor_id = ? ORDER BY donated_on DESC",
      [req.u.donorId],
    );
    res.json({ donor, history });
  }),
);

// Vercel imports the Express app as a serverless function.
// Local development still starts a normal HTTP server.
if (require.main === module) {
  app.listen(port, () =>
    console.log(`Blood bank running at http://localhost:${port}`),
  );
}

module.exports = app;
