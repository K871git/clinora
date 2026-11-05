ALTER TABLE stock_audit_log
  MODIFY COLUMN reason ENUM('manual_edit','dispensed','import','pharmacy_return','returned','adjustment') NOT NULL DEFAULT 'manual_edit';
