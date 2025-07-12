const db = require('../config/db');

// Get all vendors
exports.getAllVendors = async (req, res) => {
  try {
    const [vendors] = await db.query('SELECT * FROM vendors');
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single vendor
exports.getVendorById = async (req, res) => {
  try {
    const [vendor] = await db.query(
      'SELECT * FROM vendors WHERE id = ?', 
      [req.params.id]
    );
    
    if (vendor.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    
    res.json(vendor[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new Indian vendor
exports.createVendor = async (req, res) => {
  const { 
    company_name, 
    cin, 
    gstin, 
    industry, 
    state, 
    compliance_score,
    brsr_compliance
  } = req.body;
  
  try {
    const [result] = await db.query(
      `INSERT INTO vendors 
      (company_name, cin, gstin, industry, state, compliance_score, brsr_compliance) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [company_name, cin, gstin, industry, state, compliance_score, brsr_compliance]
    );
    
    const newVendor = {
      id: result.insertId,
      ...req.body
    };
    
    res.status(201).json(newVendor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update compliance score
exports.updateComplianceScore = async (req, res) => {
  try {
    const { compliance_score } = req.body;
    
    await db.query(
      `UPDATE vendors 
       SET compliance_score = ? 
       WHERE id = ?`,
      [compliance_score, req.params.id]
    );
    
    res.json({
      message: 'Compliance score updated',
      vendorId: req.params.id,
      newScore: compliance_score
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};