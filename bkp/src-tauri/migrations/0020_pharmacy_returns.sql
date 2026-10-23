CREATE TABLE IF NOT EXISTS `pharmacy_returns` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinic_id`       BIGINT UNSIGNED NOT NULL,
  `prescription_id` BIGINT UNSIGNED NOT NULL,
  `patient_id`      BIGINT UNSIGNED NOT NULL,
  `pharmacist_id`   BIGINT UNSIGNED NOT NULL,
  `return_number`   VARCHAR(30)     NOT NULL,
  `reason`          TEXT            NULL,
  `total_amount`    DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `notes`           TEXT            NULL,
  `created_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME        NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_phr_clinic`       (`clinic_id`),
  KEY `idx_phr_prescription` (`prescription_id`),
  KEY `idx_phr_patient`      (`patient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_return_items` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `return_id`      BIGINT UNSIGNED NOT NULL,
  `medicine_name`  VARCHAR(255)    NOT NULL,
  `quantity`       INT UNSIGNED    NOT NULL DEFAULT 1,
  `unit_price`     DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `total`          DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `created_at`     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_phri_return` (`return_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
