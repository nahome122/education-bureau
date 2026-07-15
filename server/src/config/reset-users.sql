-- Reset users with new credentials
-- Run this in MySQL after the database is initialized

DELETE FROM users WHERE id IN (1, 2, 3, 4);

INSERT INTO users (id, full_name, username, email, phone, password_hash, role_id, school_id, status, created_by)
VALUES 
(1, 'Nahom Eshetu', 'belete.guta', 'nahom@tsms.gov.et', '+251911000001',
 '$2a$12$qUobE4SBZK7rGL4EuidjcO5SIgzfmakcobQ3VxImVyi0TERrZGRAO', 1, NULL, 'Active', NULL),
(2, 'Dawit Bekele', 'schoolmanager', 'manager@tsms.gov.et', '+251922000002',
 '$2a$12$U5o/fJy.sJZvADGi8DbsDuaiozNabGL9Nb.1V9dPCc26ic0wj3Zqe', 2, 1, 'Active', 1),
(3, 'Sara Tesfaye', 'attendanceofficer', 'officer@tsms.gov.et', '+251933000003',
 '$2a$12$U5o/fJy.sJZvADGi8DbsDuaiozNabGL9Nb.1V9dPCc26ic0wj3Zqe', 3, 1, 'Active', 1),
(4, 'Yohannes Girma', 'viewer', 'viewer@tsms.gov.et', '+251944000004',
 '$2a$12$U5o/fJy.sJZvADGi8DbsDuaiozNabGL9Nb.1V9dPCc26ic0wj3Zqe', 4, 1, 'Active', 1);

SELECT 'Users updated successfully!' AS status;
