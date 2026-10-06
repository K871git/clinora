-- Generated prescription PDF path stored on disk
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS pdf_path VARCHAR(600) NULL AFTER doctor_notes;
