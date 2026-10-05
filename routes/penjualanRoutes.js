const express = require('express');
const router = express.Router();
const penjualanController = require('../controllers/penjualanController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/', verifyToken, penjualanController.getAllPenjualan);
router.get('/:noPenjualan', verifyToken, penjualanController.getPenjualanById);
router.post('/', verifyToken, penjualanController.createPenjualan);
router.patch('/:noPenjualan/status', verifyToken, penjualanController.setPenjualanStatus);
router.put('/:noPenjualan', verifyToken, penjualanController.updatePenjualan);
router.delete('/:noPenjualan', verifyToken, penjualanController.deletePenjualan);

module.exports = router;