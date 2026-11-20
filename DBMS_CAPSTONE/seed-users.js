// Creates the admin login and two donor logins (passwords are stored hashed).
const bcrypt = require("bcryptjs"),
  db = require("./db");
(async () => {
  const [ds] = await db.query(
    "SELECT id, name FROM donors WHERE available = 1 ORDER BY id LIMIT 2",
  );
  const rows = [
    ["admin", "admin123", "admin", "Blood Bank Admin", null],
    ...ds.map((d, i) => ["donor" + (i + 1), "donor123", "donor", d.name, d.id]),
  ];
  for (const [u, p, role, name, donorId] of rows) {
    await db.query(
      `INSERT INTO users (username, password_hash, role, name, donor_id) VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [u, await bcrypt.hash(p, 10), role, name, donorId],
    );
  }
  console.log("Logins ready:", rows.map((r) => `${r[0]} (${r[3]})`).join(", "));
  process.exit();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
