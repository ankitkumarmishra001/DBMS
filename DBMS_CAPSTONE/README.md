# Blood Bank & Donor Management System

Express + MySQL backend serving a plain HTML/CSS/JS frontend (`public/`).

## Setup
1. Install Node.js and MySQL. Edit `config.js` with your MySQL password.
2. In MySQL Workbench run `schema.sql`, then follow the steps inside `import.sql` (import `blood_donor_dataset_150.csv` into table `stg` with the Table Data Import Wizard first).
3. In this folder:
   ```
   npm install
   npm run seed-users
   npm start
   ```
4. Open http://localhost:3000 (do not open index.html directly).

Logins: `admin` / `admin123`, `donor1` / `donor123`, `donor2` / `donor123`.

## Where each rule lives
| Rule | Where |
|---|---|
| 90-day gap, donor must be available | trigger `trg_donation_rules` |
| Current stock, days until eligible | views `stock`, `donor_status` |
| Can't delete a donor with records | foreign keys (`ON DELETE RESTRICT`) |
| Fulfil only if stock is enough | transaction in `PATCH /api/requests/:id` |
| Admin vs donor access | `auth` / `admin` middleware in `server.js` |
| Passwords | stored as bcrypt hashes |

## Donation centres
Donors see **Where to donate** (centres, their city first, plus how donating works). Admins manage centres under **Centres**. Existing database: run `centers.sql` once in Workbench. Its names, addresses and phones are sample data to replace.

## Creating accounts
New donors can use **Create an account** on the login page. It creates the donor record and the login in one transaction, always with the `donor` role. Admin accounts are created only with `npm run seed-users` or SQL.

## Adding more donors later
Log in as admin, open Donors and use **Import donors from CSV** (needs name, city, blood_group, contact_number). `csv-to-sql.js` does the same from the command line.

## Files
- `schema.sql`, `import.sql`: database
- `server.js`, `db.js`, `config.js`, `csv.js`, `seed-users.js`, `csv-to-sql.js`: backend
- `public/`: frontend (`js/app.js` views, `js/data.js` API helper)
