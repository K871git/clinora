-- Add batch/expiry tracking and reorder level to medicines
ALTER TABLE medicines
  ADD COLUMN batch_number  VARCHAR(100)     NULL AFTER price,
  ADD COLUMN expiry_date   DATE             NULL AFTER batch_number,
  ADD COLUMN received_date DATE             NULL AFTER expiry_date,
  ADD COLUMN reorder_level INT UNSIGNED NOT NULL DEFAULT 10 AFTER received_date;

CREATE INDEX idx_medicines_expiry ON medicines (clinic_id, expiry_date);
