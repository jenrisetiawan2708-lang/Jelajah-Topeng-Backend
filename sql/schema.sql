CREATE DATABASE IF NOT EXISTS jelajah_topeng
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE jelajah_topeng;

-- Semua waktu diisi dari Node (UTC) supaya tidak tergantung timezone MySQL.

CREATE TABLE IF NOT EXISTS content_records (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  date_value VARCHAR(32) NOT NULL,
  amount TEXT NOT NULL,
  status VARCHAR(64) NOT NULL,
  correct_answer TEXT NOT NULL,
  correct_clue TEXT NOT NULL,
  image_url MEDIUMTEXT NOT NULL,
  event_date VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_records_user_kind (user_id, kind)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS seeded_kinds (
  user_id VARCHAR(64) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  PRIMARY KEY (user_id, kind)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS refunds (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  code VARCHAR(32) NOT NULL,
  requester VARCHAR(160) NOT NULL,
  participants VARCHAR(160) NOT NULL,
  destination VARCHAR(160) NOT NULL,
  trx_code VARCHAR(40) NOT NULL,
  visit_info VARCHAR(200) NOT NULL,
  filed_at DATETIME NOT NULL,
  proof_at DATETIME NOT NULL,
  amount INT NOT NULL,
  reason VARCHAR(120) NOT NULL,
  reason_detail TEXT NOT NULL,
  method VARCHAR(60) NOT NULL,
  status VARCHAR(20) NOT NULL,
  reject_reason TEXT NOT NULL,
  admin_note TEXT NOT NULL,
  decided_at DATETIME NULL,
  UNIQUE KEY uq_refund_code (user_id, code),
  KEY idx_refund_user_status (user_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS refund_logs (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  refund_id CHAR(36) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  from_status VARCHAR(20) NOT NULL,
  to_status VARCHAR(20) NOT NULL,
  note VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_logs_refund (refund_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NOT NULL,
  item_name VARCHAR(120) NOT NULL,
  amount INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  payment_type VARCHAR(40) NULL,
  snap_token VARCHAR(100) NOT NULL,
  redirect_url VARCHAR(500) NOT NULL,
  customer_name VARCHAR(120) NULL,
  customer_email VARCHAR(160) NULL,
  raw_notification TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_order (order_id),
  KEY idx_payment_user (user_id)
) ENGINE=InnoDB;