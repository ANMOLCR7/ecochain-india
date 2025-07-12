const db = require('../config/db');
const moment = require('moment-timezone');

// Get all regulations
exports.getAllRegulations = async (req, res) => {
  try {
    const [regulations] = await db.query('SELECT * FROM regulations');
    res.json(regulations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single regulation
exports.getRegulationById = async (req, res) => {
  try {
    const [regulation] = await db.query(
      'SELECT * FROM regulations WHERE id = ?', 
      [req.params.id]
    );
    
    if (regulation.length === 0) {
      return res.status(404).json({ message: 'Regulation not found' });
    }
    
    res.json(regulation[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new regulation
exports.createRegulation = async (req, res) => {
  const { 
    regulation_type, 
    ministry, 
    title, 
    deadline, 
    description, 
    applicable_to, 
    penalty,
    compliance_level 
  } = req.body;
  
  try {
    const [result] = await db.query(
      `INSERT INTO regulations 
      (regulation_type, ministry, title, deadline, description, applicable_to, penalty, compliance_level) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        regulation_type, 
        ministry, 
        title, 
        deadline, 
        description, 
        JSON.stringify(applicable_to), 
        penalty,
        compliance_level
      ]
    );
    
    const newRegulation = {
      id: result.insertId,
      ...req.body
    };
    
    res.status(201).json(newRegulation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get regulations by Indian state
exports.getRegulationsByState = async (req, res) => {
  try {
    const [regulations] = await db.query(
      `SELECT * FROM regulations 
       WHERE regulation_type = 'State' 
       AND JSON_CONTAINS(applicable_to, ?)`,
      [JSON.stringify(req.params.state)]
    );
    
    res.json(regulations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Check BRSR compliance status
exports.checkBRSRCompliance = async (req, res) => {
  try {
    const [vendor] = await db.query(
      'SELECT * FROM vendors WHERE id = ?', 
      [req.params.vendorId]
    );
    
    if (vendor.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    
    const compStatus = {
      brsrRequired: vendor[0].brsr_compliance === 1,
      lastReported: vendor[0].last_audit,
      nextDeadline: moment().tz('Asia/Kolkata').add(3, 'months').format('YYYY-MM-DD'),
      message: vendor[0].brsr_compliance ? 
               'Compliant with BRSR' : 
               'Action required: BRSR compliance needed'
    };
    
    res.json(compStatus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};