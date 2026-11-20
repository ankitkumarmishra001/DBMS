const mysql = require("mysql2/promise");
const { db } = require("./config");

if (!db.password) {
  console.warn("Database password is not configured. Set MYSQLPASSWORD or DB_PASSWORD.");
}
if (!require("./config").jwtSecret) {
  console.warn("JWT_SECRET is not configured.");
}

module.exports = mysql.createPool({
  ...db,
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});
