-- Link notes to an optional patient record
ALTER TABLE notes
  ADD COLUMN patient_id BIGINT UNSIGNED NULL DEFAULT NULL AFTER user_id,
  ADD INDEX idx_notes_patient (patient_id);
