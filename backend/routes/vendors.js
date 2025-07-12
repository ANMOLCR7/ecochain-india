const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');

// Get all vendors
router.get('/', vendorController.getAllVendors);

// Get single vendor
router.get('/:id', vendorController.getVendorById);

// Create new vendor
router.post('/', vendorController.createVendor);

// Update compliance score
router.patch('/:id/compliance', vendorController.updateComplianceScore);

module.exports = router;