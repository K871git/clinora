-- Clinora EXE — default clinic and user accounts
-- Runs once on first launch. Password for both accounts is: password
-- Users should change this immediately from Settings → Profile.

INSERT IGNORE INTO `clinics` (`id`, `name`, `doctor_name`, `created_at`, `updated_at`)
VALUES (1, 'My Clinic', 'Doctor', NOW(), NOW());

-- Doctor account  (role = doctor)
INSERT IGNORE INTO `users` (`clinic_id`, `name`, `email`, `password`, `role`, `is_active`, `created_at`, `updated_at`)
VALUES (
  1,
  'Doctor',
  'doctor@clinic.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'doctor',
  1,
  NOW(),
  NOW()
);

-- Pharmacy account  (role = pharmacy)
INSERT IGNORE INTO `users` (`clinic_id`, `name`, `email`, `password`, `role`, `is_active`, `created_at`, `updated_at`)
VALUES (
  1,
  'Pharmacist',
  'pharmacy@clinic.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'pharmacy',
  1,
  NOW(),
  NOW()
);

-- Default clinic settings
INSERT IGNORE INTO `clinic_settings` (`clinic_id`, `show_doctor_contact`, `show_clinic_contact`, `created_at`, `updated_at`)
VALUES (1, 1, 1, NOW(), NOW());
