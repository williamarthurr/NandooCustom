PRAGMA foreign_keys = ON;

CREATE TABLE masterbarang (
    KodeBarang TEXT PRIMARY KEY NOT NULL,
    NamaBarang TEXT NOT NULL,
    Satuan TEXT NOT NULL,
    SatuanHarga REAL NOT NULL
);

CREATE TABLE masterpelanggan (
    KodePelanggan TEXT PRIMARY KEY NOT NULL,
    NamaPelanggan TEXT NOT NULL,
    Alamat TEXT
);

CREATE TABLE mastersupplier (
    KodeSupplier TEXT PRIMARY KEY NOT NULL,
    NamaSupplier TEXT NOT NULL,
    Alamat TEXT,
    NoTelephone TEXT
);

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'gudang')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    last_login TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    no_telp TEXT
);

CREATE INDEX idx_users_role ON users (role);

CREATE TABLE stokin (
    NoStokIn TEXT PRIMARY KEY NOT NULL,
    Tanggal TEXT NOT NULL,
    KodeSupplier TEXT,
    GrandTotal REAL NOT NULL,
    is_synced INTEGER DEFAULT 0,
    Status TEXT NOT NULL DEFAULT 'Confirmed',
    FOREIGN KEY (KodeSupplier) REFERENCES mastersupplier (KodeSupplier) ON DELETE SET NULL
);

CREATE INDEX idx_stokin_supplier ON stokin (KodeSupplier);
CREATE INDEX idx_stokin_status ON stokin (Status);

CREATE TABLE penjualan (
    NoPenjualan TEXT PRIMARY KEY NOT NULL,
    Tanggal TEXT NOT NULL,
    KodePelanggan TEXT,
    GrandTotal REAL NOT NULL,
    is_synced INTEGER DEFAULT 0,
    Status TEXT NOT NULL DEFAULT 'Confirmed',
    FOREIGN KEY (KodePelanggan) REFERENCES masterpelanggan (KodePelanggan) ON DELETE SET NULL
);

CREATE INDEX idx_penjualan_pelanggan ON penjualan (KodePelanggan);
CREATE INDEX idx_penjualan_status ON penjualan (Status);

CREATE TABLE detailstokin (
    IDDetail INTEGER PRIMARY KEY AUTOINCREMENT,
    NoStokIn TEXT NOT NULL,
    KodeBarang TEXT NOT NULL,
    Qty INTEGER NOT NULL,
    SatuanHarga REAL NOT NULL,
    Subtotal REAL NOT NULL,
    FOREIGN KEY (NoStokIn) REFERENCES stokin (NoStokIn) ON DELETE CASCADE,
    FOREIGN KEY (KodeBarang) REFERENCES masterbarang (KodeBarang)
);

CREATE INDEX idx_detailstokin_stokin ON detailstokin (NoStokIn);
CREATE INDEX idx_detailstokin_barang ON detailstokin (KodeBarang);

CREATE TABLE detailpenjualan (
    IDDetail INTEGER PRIMARY KEY AUTOINCREMENT,
    NoPenjualan TEXT NOT NULL,
    KodeBarang TEXT NOT NULL,
    NoStokIn TEXT,
    Qty INTEGER NOT NULL,
    SatuanHarga REAL NOT NULL,
    Subtotal REAL NOT NULL,
    FOREIGN KEY (NoPenjualan) REFERENCES penjualan (NoPenjualan) ON DELETE CASCADE,
    FOREIGN KEY (KodeBarang) REFERENCES masterbarang (KodeBarang)
);

CREATE INDEX idx_detailpenjualan_penjualan ON detailpenjualan (NoPenjualan);
CREATE INDEX idx_detailpenjualan_barang ON detailpenjualan (KodeBarang);
CREATE INDEX idx_detailpenjualan_stokin_barang ON detailpenjualan (NoStokIn, KodeBarang);

CREATE TABLE inventorystock (
    KodeBarang TEXT PRIMARY KEY NOT NULL,
    StokCurrent INTEGER NOT NULL DEFAULT 0,
    LastUpdated TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (KodeBarang) REFERENCES masterbarang (KodeBarang) ON DELETE CASCADE
);

CREATE TABLE inventorylog (
    LogID INTEGER PRIMARY KEY AUTOINCREMENT,
    Tanggal TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KodeBarang TEXT NOT NULL,
    JenisTransaksi TEXT NOT NULL CHECK (JenisTransaksi IN ('Stokin', 'penjualan', 'ADJUSTMENT')),
    NoReferensi TEXT NOT NULL,
    QtyMasuk INTEGER DEFAULT 0,
    QtyKeluar INTEGER DEFAULT 0,
    StokAwal INTEGER NOT NULL,
    StokAkhir INTEGER NOT NULL,
    Keterangan TEXT,
    FOREIGN KEY (KodeBarang) REFERENCES masterbarang (KodeBarang) ON DELETE CASCADE
);

CREATE INDEX idx_inventorylog_barang ON inventorylog (KodeBarang);
