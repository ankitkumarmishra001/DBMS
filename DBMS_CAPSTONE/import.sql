USE bloodbank;

CREATE TABLE stg (
  donor_id CHAR(10), name VARCHAR(80), email VARCHAR(80), password VARCHAR(30),
  contact_number VARCHAR(20), city VARCHAR(50), blood_group VARCHAR(3), availability VARCHAR(3),
  months_since_first_donation INT, number_of_donation INT, pints_donated INT, created_at DATE);


INSERT INTO donors (donor_code, name, email, phone, city, blood_group, available,
                    months_since_first, total_donations, total_pints, registered_on)
SELECT donor_id, name, email, contact_number, city, blood_group, availability = 'Yes',
       months_since_first_donation, number_of_donation, pints_donated, created_at
FROM stg;
DROP TABLE stg;

INSERT INTO donations (donor_id, donated_on, units)
SELECT id, DATE_SUB(CURDATE(), INTERVAL FLOOR(RAND() * 80) DAY), 1 + FLOOR(RAND() * 2)
FROM donors WHERE available = 1 ORDER BY RAND() LIMIT 80;

INSERT INTO requests (hospital, blood_group, units, requested_on, status, urgent) VALUES
 ('City General', 'O-', 2, CURDATE(), 'Pending', 1),
 ('Lotus Care', 'B+', 1, CURDATE(), 'Pending', 0),
 ('Apex Trauma Centre', 'A+', 1, CURDATE(), 'Pending', 0);
