CREATE DATABASE IF NOT EXISTS clinoraDB
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE clinoraDB;


CREATE TABLE clinics (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    doctor_name VARCHAR(150) NOT NULL,
    qualification VARCHAR(150) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    contact VARCHAR(30) DEFAULT NULL,
    logo_path VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    clinic_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('doctor', 'pharmacy') NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    remember_token VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY users_email_unique (email),
    KEY users_clinic_id_index (clinic_id),

    CONSTRAINT users_clinic_fk
        FOREIGN KEY (clinic_id)
        REFERENCES clinics (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE patients (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    clinic_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    date_of_birth DATE DEFAULT NULL,
    age INT UNSIGNED DEFAULT NULL,
    gender ENUM('male', 'female', 'other') DEFAULT NULL,
    address TEXT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (id),
    KEY patients_clinic_id_index (clinic_id),
    KEY patients_name_index (name),
    KEY patients_mobile_index (mobile),

    CONSTRAINT patients_clinic_fk
        FOREIGN KEY (clinic_id)
        REFERENCES clinics (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE visits (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    clinic_id BIGINT UNSIGNED NOT NULL,
    patient_id BIGINT UNSIGNED NOT NULL,
    doctor_id BIGINT UNSIGNED NOT NULL,
    visited_at DATETIME NOT NULL,
    consultation_notes TEXT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (id),
    KEY visits_clinic_id_index (clinic_id),
    KEY visits_patient_id_index (patient_id),
    KEY visits_doctor_id_index (doctor_id),
    KEY visits_visited_at_index (visited_at),

    CONSTRAINT visits_clinic_fk
        FOREIGN KEY (clinic_id)
        REFERENCES clinics (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT visits_patient_fk
        FOREIGN KEY (patient_id)
        REFERENCES patients (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT visits_doctor_fk
        FOREIGN KEY (doctor_id)
        REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE prescriptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    clinic_id BIGINT UNSIGNED NOT NULL,
    patient_id BIGINT UNSIGNED NOT NULL,
    visit_id BIGINT UNSIGNED NOT NULL,
    doctor_id BIGINT UNSIGNED NOT NULL,
    prescribed_at DATETIME NOT NULL,
    doctor_notes TEXT DEFAULT NULL,
    status ENUM('draft', 'sent_to_pharmacy', 'completed', 'cancelled')
        NOT NULL DEFAULT 'draft',
    sent_to_pharmacy_at DATETIME DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,
    completed_by BIGINT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (id),
    KEY prescriptions_clinic_id_index (clinic_id),
    KEY prescriptions_patient_id_index (patient_id),
    KEY prescriptions_visit_id_index (visit_id),
    KEY prescriptions_doctor_id_index (doctor_id),
    KEY prescriptions_status_index (status),
    KEY prescriptions_completed_by_index (completed_by),

    CONSTRAINT prescriptions_clinic_fk
        FOREIGN KEY (clinic_id)
        REFERENCES clinics (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT prescriptions_patient_fk
        FOREIGN KEY (patient_id)
        REFERENCES patients (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT prescriptions_visit_fk
        FOREIGN KEY (visit_id)
        REFERENCES visits (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT prescriptions_doctor_fk
        FOREIGN KEY (doctor_id)
        REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT prescriptions_completed_by_fk
        FOREIGN KEY (completed_by)
        REFERENCES users (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE prescription_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    prescription_id BIGINT UNSIGNED NOT NULL,
    medicine_name VARCHAR(200) NOT NULL,
    dosage VARCHAR(100) DEFAULT NULL,
    frequency VARCHAR(100) DEFAULT NULL,
    duration VARCHAR(100) DEFAULT NULL,
    instructions TEXT DEFAULT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (id),
    KEY prescription_items_prescription_id_index (prescription_id),

    CONSTRAINT prescription_items_prescription_fk
        FOREIGN KEY (prescription_id)
        REFERENCES prescriptions (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE clinic_settings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    clinic_id BIGINT UNSIGNED NOT NULL,
    prescription_header TEXT DEFAULT NULL,
    prescription_footer TEXT DEFAULT NULL,
    show_doctor_contact TINYINT(1) NOT NULL DEFAULT 1,
    show_clinic_contact TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY clinic_settings_clinic_id_unique (clinic_id),

    CONSTRAINT clinic_settings_clinic_fk
        FOREIGN KEY (clinic_id)
        REFERENCES clinics (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;