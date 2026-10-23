-- Add GST percent to clinic_settings
ALTER TABLE clinic_settings
  ADD COLUMN gst_percent DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Add patient consent flag for DPDP compliance
ALTER TABLE patients
  ADD COLUMN consent_obtained TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN consent_date DATE NULL;
