CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id  BIGINT UNSIGNED NOT NULL,
    actor_id   BIGINT UNSIGNED NOT NULL,
    action     VARCHAR(50)     NOT NULL,
    entity     VARCHAR(50)     NOT NULL,
    entity_id  BIGINT UNSIGNED NOT NULL,
    detail     TEXT,
    created_at DATETIME        NOT NULL,
    INDEX idx_clinic_entity  (clinic_id, entity, entity_id),
    INDEX idx_clinic_created (clinic_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
