ALTER TABLE `visits`
  ADD COLUMN `diagnosis` TEXT NULL DEFAULT NULL AFTER `consultation_notes`;
