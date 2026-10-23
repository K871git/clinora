CREATE TABLE IF NOT EXISTS stock_audit_log (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinic_id     BIGINT UNSIGNED NOT NULL,
    item_type     ENUM('medicine','stock_item') NOT NULL,
    item_id       BIGINT UNSIGNED NOT NULL,
    item_name     VARCHAR(255) NOT NULL,
    old_qty       INT NOT NULL DEFAULT 0,
    new_qty       INT NOT NULL DEFAULT 0,
    change_delta  INT NOT NULL DEFAULT 0,
    reason        ENUM('manual_edit','dispensed','import') NOT NULL DEFAULT 'manual_edit',
    prescription_id BIGINT UNSIGNED NULL,
    notes         TEXT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sal_item  (clinic_id, item_type, item_id),
    INDEX idx_sal_ts    (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
