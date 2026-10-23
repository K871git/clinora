ALTER TABLE `patients`
  ADD COLUMN `emergency_contact_name`  VARCHAR(150) NULL DEFAULT NULL,
  ADD COLUMN `emergency_contact_phone` VARCHAR(20)  NULL DEFAULT NULL;
