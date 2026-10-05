ALTER TABLE stokin
    ADD COLUMN Status VARCHAR(20) NOT NULL DEFAULT 'Confirmed',
    ADD INDEX idx_stokin_status (Status);

ALTER TABLE penjualan
    ADD COLUMN Status VARCHAR(20) NOT NULL DEFAULT 'Confirmed',
    ADD INDEX idx_penjualan_status (Status);
