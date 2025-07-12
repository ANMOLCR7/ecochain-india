const express = require('express');
const router = express.Router();
const regulationController = require('../controllers/regulationController');

// Regulation routes
router.get('/', regulationController.getAllRegulations);
router.get('/:id', regulationController.getRegulationById);
router.get('/state/:state', regulationController.getRegulationsByState);
router.post('/', regulationController.createRegulation);
router.get('/brsr/:vendorId', regulationController.checkBRSRCompliance);

module.exports = router;