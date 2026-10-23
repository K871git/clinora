CREATE TABLE IF NOT EXISTS notes (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  clinic_id   BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  role        VARCHAR(30)  NOT NULL DEFAULT 'doctor',
  title       VARCHAR(255) NOT NULL DEFAULT '',
  body        LONGTEXT     NULL,
  tags        VARCHAR(500) NULL,
  attachments LONGTEXT     NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NULL DEFAULT NULL,

  INDEX idx_notes_clinic (clinic_id, role),
  INDEX idx_notes_user   (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
