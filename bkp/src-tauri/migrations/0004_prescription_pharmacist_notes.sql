-- Add pharmacist notes to prescriptions
ALTER TABLE prescriptions
  ADD COLUMN pharmacist_notes TEXT NULL AFTER doctor_notes;
