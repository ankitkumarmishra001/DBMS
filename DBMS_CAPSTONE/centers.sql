-- Run this once if your database already exists (it adds the donation centres table and sample centres).
-- The names, addresses and phone numbers below are SAMPLE data. Replace them with real centres from the admin page.
USE bloodbank;
CREATE TABLE IF NOT EXISTS centers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  city VARCHAR(50) NOT NULL,
  address VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  hours VARCHAR(80) NOT NULL,
  INDEX idx_center_city (city)
);

-- only inserts when the table is empty, so running it twice is safe
INSERT INTO centers (name, city, address, phone, hours)
SELECT * FROM (
  SELECT 'LifeFlow Donor Centre, CBD' AS name, 'Sydney' AS city, 'Level 2, 100 Example Street' AS address, '+61 200 000 101' AS phone, 'Mon-Fri 9am-5pm, Sat 9am-1pm' AS hours
  UNION ALL SELECT 'LifeFlow Donor Centre, Parramatta', 'Sydney', '25 Sample Road', '+61 200 000 102', 'Tue-Sat 10am-6pm'
  UNION ALL SELECT 'LifeFlow Donor Centre, Southbank', 'Melbourne', '12 Example Avenue', '+61 300 000 103', 'Mon-Fri 8am-4pm'
  UNION ALL SELECT 'LifeFlow Donor Centre, Fortitude Valley', 'Brisbane', '48 Sample Lane', '+61 700 000 104', 'Mon-Sat 9am-5pm'
  UNION ALL SELECT 'LifeFlow Donor Centre, Northbridge', 'Perth', '7 Example Place', '+61 800 000 105', 'Mon-Fri 9am-5pm'
  UNION ALL SELECT 'LifeFlow Donor Centre, Rundle Mall', 'Adelaide', '33 Sample Street', '+61 800 000 106', 'Mon-Fri 9am-4pm, Sat 9am-12pm'
  UNION ALL SELECT 'LifeFlow Donor Centre, Salamanca', 'Hobart', '5 Example Court', '+61 300 000 107', 'Tue-Fri 10am-4pm'
  UNION ALL SELECT 'LifeFlow Donor Centre, Mitchell Street', 'Darwin', '19 Sample Terrace', '+61 800 000 108', 'Mon-Fri 8am-3pm'
  UNION ALL SELECT 'LifeFlow Donor Centre, Civic', 'Canberra', '60 Example Circuit', '+61 200 000 109', 'Mon-Sat 9am-5pm'
) t WHERE NOT EXISTS (SELECT 1 FROM centers);
SELECT COUNT(*) AS centres FROM centers;
