-- Create lab_reports table with all columns in one atomic statement.
-- IF NOT EXISTS makes this safe to run on any database state.
CREATE TABLE IF NOT EXISTS `lab_reports` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `patient_id`   BIGINT UNSIGNED NOT NULL,
  `visit_id`     BIGINT UNSIGNED NULL,
  `report_name`  VARCHAR(255)    NOT NULL,
  `lab_name`     VARCHAR(255)    NULL,
  `file_path`    VARCHAR(255)    NULL,
  `file_name`    VARCHAR(255)    NULL,
  `notes`        TEXT            NULL,
  `status`       ENUM('ordered','received','reviewed') NOT NULL DEFAULT 'ordered',
  `ordered_at`   DATE            NULL,
  `received_at`  DATE            NULL,
  `results_json` LONGTEXT        NULL DEFAULT NULL,
  `created_at`   TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`   TIMESTAMP       NULL DEFAULT NULL,
  INDEX `idx_lab_reports_patient` (`patient_id`),
  CONSTRAINT `lab_reports_patient_id_fk`
    FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lab_reports_visit_id_fk`
    FOREIGN KEY (`visit_id`) REFERENCES `visits` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
