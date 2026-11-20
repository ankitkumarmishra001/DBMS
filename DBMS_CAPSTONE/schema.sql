-- Run this whole file in MySQL Workbench (File > Open SQL Script > run all).
DROP DATABASE IF EXISTS bloodbank;
CREATE DATABASE bloodbank;
USE bloodbank;

CREATE TABLE donors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_code CHAR(10) NOT NULL UNIQUE,           -- donor_id from the CSV
  name VARCHAR(80) NOT NULL,
  email VARCHAR(80) NOT NULL,                    -- not UNIQUE: the dataset has duplicate emails
  phone VARCHAR(20) NOT NULL,
  city VARCHAR(50) NOT NULL,
  blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
  available BOOLEAN NOT NULL DEFAULT 1,
  months_since_first INT,
  total_donations INT NOT NULL DEFAULT 0,        -- lifetime totals from the dataset
  total_pints INT NOT NULL DEFAULT 0,
  registered_on DATE NOT NULL,
  INDEX idx_group (blood_group), INDEX idx_city (city), INDEX idx_name (name)
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(40) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('admin','donor') NOT NULL,
  name VARCHAR(80) NOT NULL,
  donor_id INT NULL,
  FOREIGN KEY (donor_id) REFERENCES donors(id)
);

CREATE TABLE donations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  donated_on DATE NOT NULL,
  units TINYINT NOT NULL CHECK (units BETWEEN 1 AND 2),
  FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE RESTRICT,
  INDEX idx_donor_date (donor_id, donated_on)
);

CREATE TABLE requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital VARCHAR(80) NOT NULL,
  blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
  units INT NOT NULL CHECK (units BETWEEN 1 AND 10),
  requested_on DATE NOT NULL,
  status ENUM('Pending','Fulfilled','Rejected') NOT NULL DEFAULT 'Pending',
  urgent BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE centers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  city VARCHAR(50) NOT NULL,
  address VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  hours VARCHAR(80) NOT NULL,
  INDEX idx_center_city (city)
);

-- Business rules for new donations live in the database
DELIMITER //
CREATE TRIGGER trg_donation_rules BEFORE INSERT ON donations
FOR EACH ROW
BEGIN
  DECLARE is_available BOOLEAN;
  DECLARE last_d DATE;
  SELECT available INTO is_available FROM donors WHERE id = NEW.donor_id;
  IF is_available = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This donor is marked unavailable.';
  END IF;
  SELECT MAX(donated_on) INTO last_d FROM donations WHERE donor_id = NEW.donor_id;
  IF last_d IS NOT NULL AND DATEDIFF(NEW.donated_on, last_d) < 90 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This donor must wait 90 days between donations.';
  END IF;
END//
DELIMITER ;

-- Days left until each donor can donate again
CREATE VIEW donor_status AS
SELECT d.*, MAX(n.donated_on) AS last_donated,
       COALESCE(GREATEST(0, 90 - DATEDIFF(CURDATE(), MAX(n.donated_on))), 0) AS wait_days
FROM donors d LEFT JOIN donations n ON n.donor_id = d.id
GROUP BY d.id;

-- Current stock = recorded donations - fulfilled requests, per blood group
CREATE VIEW stock AS
SELECT g.blood_group,
  CAST(COALESCE((SELECT SUM(n.units) FROM donations n JOIN donors d ON d.id = n.donor_id
                 WHERE d.blood_group = g.blood_group), 0)
     - COALESCE((SELECT SUM(r.units) FROM requests r
                 WHERE r.blood_group = g.blood_group AND r.status = 'Fulfilled'), 0) AS SIGNED) AS units
FROM (SELECT 'A+' blood_group UNION ALL SELECT 'A-' UNION ALL SELECT 'B+' UNION ALL SELECT 'B-'
      UNION ALL SELECT 'AB+' UNION ALL SELECT 'AB-' UNION ALL SELECT 'O+' UNION ALL SELECT 'O-') g;
