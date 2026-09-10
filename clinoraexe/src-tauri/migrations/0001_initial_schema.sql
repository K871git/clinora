-- Clinora EXE — initial schema
-- sqlx runs this once on first launch; subsequent starts skip it.

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `clinics` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(150)    NOT NULL,
  `doctor_name`   VARCHAR(150)    NOT NULL DEFAULT '',
  `qualification` VARCHAR(150)    NULL,
  `address`       TEXT            NULL,
  `contact`       VARCHAR(30)     NULL,
  `logo_path`     VARCHAR(255)    NULL,
  `created_at`    TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`    TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinic_id`      BIGINT UNSIGNED NOT NULL,
  `name`           VARCHAR(150)    NOT NULL,
  `email`          VARCHAR(150)    NOT NULL,
  `password`       VARCHAR(255)    NOT NULL,
  `role`           ENUM('doctor','pharmacy') NOT NULL,
  `is_active`      TINYINT         NOT NULL DEFAULT 1,
  `avatar`         VARCHAR(255)    NULL,
  `username`       VARCHAR(100)    NULL,
  `phone`          VARCHAR(30)     NULL,
  `gender`         ENUM('male','female','other') NULL,
  `dob`            DATE            NULL,
  `address`        TEXT            NULL,
  `remember_token` VARCHAR(100)    NULL,
  `created_at`     TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`     TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  CONSTRAINT `users_clinic_id_foreign`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `patients` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinic_id`     BIGINT UNSIGNED NOT NULL,
  `name`          VARCHAR(150)    NOT NULL,
  `mobile`        VARCHAR(20)     NULL,
  `date_of_birth` DATE            NULL,
  `age`           INT UNSIGNED    NULL,
  `gender`        ENUM('male','female','other') NULL,
  `address`       TEXT            NULL,
  `deleted_at`    TIMESTAMP       NULL DEFAULT NULL,
  `created_at`    TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`    TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `patients_name_index`   (`name`),
  KEY `patients_mobile_index` (`mobile`),
  CONSTRAINT `patients_clinic_id_foreign`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `visits` (
  `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinic_id`          BIGINT UNSIGNED NOT NULL,
  `patient_id`         BIGINT UNSIGNED NOT NULL,
  `doctor_id`          BIGINT UNSIGNED NOT NULL,
  `visited_at`         DATETIME        NOT NULL,
  `consultation_notes` TEXT            NULL,
  `consultation_fee`   DECIMAL(10,2)   NULL DEFAULT 0,
  `status`             VARCHAR(50)     NOT NULL DEFAULT 'open',
  `invoiced_at`        DATETIME        NULL,
  `payment_status`     VARCHAR(20)     NOT NULL DEFAULT 'unpaid',
  `amount_paid`        DECIMAL(10,2)   NOT NULL DEFAULT 0,
  `payment_notes`      TEXT            NULL,
  `deleted_at`         TIMESTAMP       NULL DEFAULT NULL,
  `created_at`         TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`         TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `visits_visited_at_index` (`visited_at`),
  CONSTRAINT `visits_clinic_id_foreign`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `visits_patient_id_foreign`
    FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `visits_doctor_id_foreign`
    FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `prescriptions` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinic_id`           BIGINT UNSIGNED NOT NULL,
  `patient_id`          BIGINT UNSIGNED NOT NULL,
  `visit_id`            BIGINT UNSIGNED NOT NULL,
  `doctor_id`           BIGINT UNSIGNED NOT NULL,
  `prescribed_at`       DATETIME        NOT NULL,
  `doctor_notes`        TEXT            NULL,
  `status`              VARCHAR(50)     NOT NULL DEFAULT 'draft',
  `sent_to_pharmacy_at` DATETIME        NULL,
  `dispensed_at`        DATETIME        NULL,
  `completed_at`        DATETIME        NULL,
  `completed_by`        BIGINT UNSIGNED NULL,
  `payment_status`      VARCHAR(20)     NOT NULL DEFAULT 'unpaid',
  `amount_paid`         DECIMAL(10,2)   NOT NULL DEFAULT 0,
  `payment_notes`       TEXT            NULL,
  `deleted_at`          TIMESTAMP       NULL DEFAULT NULL,
  `created_at`          TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`          TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `prescriptions_status_index` (`status`),
  CONSTRAINT `prescriptions_clinic_id_foreign`
    FOREIGN KEY (`clinic_id`)   REFERENCES `clinics` (`id`)  ON DELETE RESTRICT,
  CONSTRAINT `prescriptions_patient_id_foreign`
    FOREIGN KEY (`patient_id`)  REFERENCES `patients` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `prescriptions_visit_id_foreign`
    FOREIGN KEY (`visit_id`)    REFERENCES `visits` (`id`)   ON DELETE RESTRICT,
  CONSTRAINT `prescriptions_doctor_id_foreign`
    FOREIGN KEY (`doctor_id`)   REFERENCES `users` (`id`)    ON DELETE RESTRICT,
  CONSTRAINT `prescriptions_completed_by_foreign`
    FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `prescription_items` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `prescription_id` BIGINT UNSIGNED NOT NULL,
  `medicine_name`   VARCHAR(200)    NOT NULL,
  `dosage`          VARCHAR(100)    NULL,
  `frequency`       VARCHAR(100)    NULL,
  `duration`        VARCHAR(100)    NULL,
  `instructions`    TEXT            NULL,
  `sort_order`      INT UNSIGNED    NOT NULL DEFAULT 0,
  `unit_price`      DECIMAL(10,2)   NULL DEFAULT NULL,
  `deleted_at`      TIMESTAMP       NULL DEFAULT NULL,
  `created_at`      TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`      TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `prescription_items_prescription_id_foreign`
    FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `clinic_settings` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinic_id`             BIGINT UNSIGNED NOT NULL,
  `prescription_header`   TEXT            NULL,
  `prescription_footer`   TEXT            NULL,
  `show_doctor_contact`   TINYINT         NOT NULL DEFAULT 1,
  `show_clinic_contact`   TINYINT         NOT NULL DEFAULT 1,
  `prescription_template` VARCHAR(255)    NULL,
  `created_at`            TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`            TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clinic_settings_clinic_id_unique` (`clinic_id`),
  CONSTRAINT `clinic_settings_clinic_id_foreign`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `medicines` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinic_id`    BIGINT UNSIGNED NOT NULL,
  `name`         VARCHAR(255)    NOT NULL,
  `generic_name` VARCHAR(255)    NULL,
  `category`     VARCHAR(100)    NULL,
  `unit`         VARCHAR(50)     NULL,
  `quantity`     INT UNSIGNED    NOT NULL DEFAULT 0,
  `price`        DECIMAL(10,2)   NULL,
  `created_at`   TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`   TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `medicines_clinic_id_name_index` (`clinic_id`, `name`),
  CONSTRAINT `medicines_clinic_id_foreign`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_items` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinic_id`      BIGINT UNSIGNED NOT NULL,
  `name`           VARCHAR(255)    NOT NULL,
  `category`       VARCHAR(255)    NULL,
  `unit`           VARCHAR(255)    NULL,
  `selling_price`  DECIMAL(10,2)   NULL,
  `stock_quantity` INT UNSIGNED    NOT NULL DEFAULT 0,
  `description`    TEXT            NULL,
  `created_at`     TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`     TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `stock_items_clinic_id_index` (`clinic_id`),
  CONSTRAINT `stock_items_clinic_id_foreign`
    FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
