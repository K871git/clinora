-- Phase 2: Billing & Revenue
-- payment_method on visits, fee_templates, visit_charges

ALTER TABLE `visits`
  ADD COLUMN `payment_method` VARCHAR(30) NULL DEFAULT NULL AFTER `payment_notes`;

CREATE TABLE IF NOT EXISTS `fee_templates` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinic_id`  BIGINT UNSIGNED NOT NULL,
  `name`       VARCHAR(150)    NOT NULL,
  `amount`     DECIMAL(10,2)   NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP       NULL DEFAULT NULL,
  `updated_at` TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fee_templates_clinic_id_index` (`clinic_id`),
  CONSTRAINT `fee_templates_clinic_id_foreign`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `visit_charges` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `visit_id`    BIGINT UNSIGNED NOT NULL,
  `description` VARCHAR(255)    NOT NULL,
  `amount`      DECIMAL(10,2)   NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `visit_charges_visit_id_index` (`visit_id`),
  CONSTRAINT `visit_charges_visit_id_foreign`
    FOREIGN KEY (`visit_id`) REFERENCES `visits` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
