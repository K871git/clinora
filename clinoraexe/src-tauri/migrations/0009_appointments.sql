CREATE TABLE IF NOT EXISTS `appointments` (
  `id`               BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `patient_id`       BIGINT UNSIGNED   NOT NULL,
  `user_id`          BIGINT UNSIGNED   NOT NULL,
  `title`            VARCHAR(255)      NULL,
  `scheduled_at`     DATETIME          NOT NULL,
  `duration_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  `status`           VARCHAR(50)       NOT NULL DEFAULT 'scheduled',
  `type`             VARCHAR(50)       NOT NULL DEFAULT 'consultation',
  `notes`            TEXT              NULL,
  `created_at`       TIMESTAMP         NULL DEFAULT NULL,
  `updated_at`       TIMESTAMP         NULL DEFAULT NULL,
  INDEX `idx_appointments_patient`      (`patient_id`),
  INDEX `idx_appointments_user`         (`user_id`),
  INDEX `idx_appointments_scheduled_at` (`scheduled_at`),
  CONSTRAINT `appointments_patient_id_fk`
    FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `appointments_user_id_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
