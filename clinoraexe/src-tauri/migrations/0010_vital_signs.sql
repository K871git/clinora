CREATE TABLE IF NOT EXISTS `vital_signs` (
  `id`               BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `patient_id`       BIGINT UNSIGNED   NOT NULL,
  `visit_id`         BIGINT UNSIGNED   NULL,
  `bp_systolic`      SMALLINT UNSIGNED NULL,
  `bp_diastolic`     SMALLINT UNSIGNED NULL,
  `pulse`            SMALLINT UNSIGNED NULL,
  `temperature`      DECIMAL(5,2)      NULL,
  `weight`           DECIMAL(5,2)      NULL,
  `height`           DECIMAL(5,2)      NULL,
  `spo2`             TINYINT UNSIGNED  NULL,
  `respiratory_rate` SMALLINT UNSIGNED NULL,
  `blood_group`      VARCHAR(10)       NULL,
  `notes`            TEXT              NULL,
  `recorded_at`      DATETIME          NOT NULL,
  `created_at`       TIMESTAMP         NULL DEFAULT NULL,
  `updated_at`       TIMESTAMP         NULL DEFAULT NULL,
  INDEX `idx_vital_signs_patient` (`patient_id`),
  CONSTRAINT `vital_signs_patient_id_fk`
    FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vital_signs_visit_id_fk`
    FOREIGN KEY (`visit_id`) REFERENCES `visits` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
