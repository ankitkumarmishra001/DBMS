const required = (name, fallback) => process.env[name] || fallback;

module.exports = {
  db: {
    host: required("DB_HOST", required("MYSQLHOST", "localhost")),
    port: Number(required("DB_PORT", required("MYSQLPORT", "3306"))),
    user: required("DB_USER", required("MYSQLUSER", "root")),
    password: required("DB_PASSWORD", required("MYSQLPASSWORD", "")),
    database: required("DB_NAME", required("MYSQLDATABASE", "bloodbank")),
    // Railway public MySQL connections use TLS. Set DB_SSL=false only for local development.
    ssl: process.env.DB_SSL === "false" ? undefined : { rejectUnauthorized: false },
  },
  jwtSecret: required("JWT_SECRET", ""),
  port: Number(process.env.PORT || 3000),
};
