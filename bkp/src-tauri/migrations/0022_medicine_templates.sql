CREATE TABLE IF NOT EXISTS `medicine_templates` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `clinic_id`  BIGINT UNSIGNED NOT NULL,
  `name`       VARCHAR(200)    NOT NULL,
  `morning`    TINYINT(1)      NOT NULL DEFAULT 0,
  `afternoon`  TINYINT(1)      NOT NULL DEFAULT 0,
  `evening`    TINYINT(1)      NOT NULL DEFAULT 0,
  `meal`       ENUM('before','after','both','none') NOT NULL DEFAULT 'none',
  `days`       SMALLINT UNSIGNED NULL,
  `quantity`   VARCHAR(80)     NULL,
  `notes`      TEXT            NULL,
  `language`   VARCHAR(5)      NOT NULL DEFAULT 'en',
  `created_at` TIMESTAMP       NULL DEFAULT NULL,
  `updated_at` TIMESTAMP       NULL DEFAULT NULL,
  INDEX `idx_medtpl_clinic` (`clinic_id`),
  INDEX `idx_medtpl_name`   (`clinic_id`, `name`),
  CONSTRAINT `fk_medtpl_clinic`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
