CREATE TABLE IF NOT EXISTS `medical_certificates` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinic_id`  BIGINT UNSIGNED NOT NULL,
  `patient_id` BIGINT UNSIGNED NOT NULL,
  `visit_id`   BIGINT UNSIGNED NULL,
  `doctor_id`  BIGINT UNSIGNED NOT NULL,
  `cert_type`  VARCHAR(50)     NOT NULL DEFAULT 'fitness',
  `purpose`    TEXT            NULL,
  `valid_from` DATE            NULL,
  `valid_until` DATE           NULL,
  `notes`      TEXT            NULL,
  `created_at` TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME        NOT NULL,
  `deleted_at` DATETIME        NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mc_clinic`   (`clinic_id`),
  KEY `idx_mc_patient`  (`patient_id`),
  KEY `idx_mc_visit`    (`visit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
