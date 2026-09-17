CREATE TABLE IF NOT EXISTS `medical_histories` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `patient_id`   BIGINT UNSIGNED NOT NULL,
  `type`         VARCHAR(100)    NOT NULL,
  `title`        VARCHAR(255)    NOT NULL,
  `description`  TEXT            NULL,
  `severity`     VARCHAR(50)     NULL,
  `diagnosed_at` DATE            NULL,
  `is_active`    TINYINT         NOT NULL DEFAULT 1,
  `created_at`   TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`   TIMESTAMP       NULL DEFAULT NULL,
  INDEX `idx_medical_histories_patient` (`patient_id`),
  CONSTRAINT `medical_histories_patient_id_fk`
    FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
