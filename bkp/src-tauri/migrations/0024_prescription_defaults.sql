-- Default prescription template settings
ALTER TABLE clinic_settings
  ADD COLUMN watermark_text    VARCHAR(100) NOT NULL DEFAULT 'Clinora' AFTER gst_percent,
  ADD COLUMN watermark_color   VARCHAR(20)  NOT NULL DEFAULT '#0d9488' AFTER watermark_text,
  ADD COLUMN watermark_enabled TINYINT(1)   NOT NULL DEFAULT 1         AFTER watermark_color;

-- Clinic hours / availability for prescription header
ALTER TABLE clinics
  ADD COLUMN clinic_timing VARCHAR(300) NULL AFTER contact,
  ADD COLUMN clinic_days   VARCHAR(200) NULL AFTER clinic_timing;
