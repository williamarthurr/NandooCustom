const express = require('express');
const cors = require('cors');
const path = require('node:path');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use(express.static(path.join(__dirname, 'public')));

// Import Routes
const authRoutes = require('./routes/authRoutes');
const createMasterDataRouter = require('./routes/masterDataRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const penjualanRoutes = require('./routes/penjualanRoutes');
const stokinRoutes = require('./routes/stokinRoutes');
const userRoutes = require('./routes/userRoutes');

// Mount Routes
app.use('/api', authRoutes);
app.use('/api/barang', createMasterDataRouter('barang'));
app.use('/api/supplier', createMasterDataRouter('supplier'));
app.use('/api/pelanggan', createMasterDataRouter('pelanggan'));
app.use('/api/inventory', inventoryRoutes);
app.use('/api/penjualan', penjualanRoutes);
app.use('/api/stokin', stokinRoutes);
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server nandoApp berjalan di http://localhost:${PORT}`);
});