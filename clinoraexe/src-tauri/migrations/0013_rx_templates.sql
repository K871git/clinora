CREATE TABLE IF NOT EXISTS `rx_prescription_templates` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `clinic_id`  BIGINT UNSIGNED NOT NULL,
  `name`       VARCHAR(120)    NOT NULL,
  `medicines`  LONGTEXT        NOT NULL,
  `notes`      TEXT            NULL,
  `created_at` TIMESTAMP       NULL DEFAULT NULL,
  `updated_at` TIMESTAMP       NULL DEFAULT NULL,
  INDEX `idx_rx_tmpl_clinic` (`clinic_id`),
  CONSTRAINT `fk_rx_tmpl_clinic`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
