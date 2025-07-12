// backend/routes/reports.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const moment = require('moment-timezone');
const router = express.Router();

// Get recent reports
router.get('/recent', async (req, res) => {
  try {
    // Get recent reports from database or generate from recent activity
    const [regulations] = await db.query('SELECT * FROM regulations ORDER BY created_at DESC LIMIT 5');
    const [vendors] = await db.query('SELECT * FROM vendors ORDER BY last_audit DESC LIMIT 5');
    
    const recentReports = [];
    
    // Generate regulatory reports
    regulations.forEach((reg, index) => {
      recentReports.push({
        id: `reg_${reg.id}`,
        title: `${reg.regulation_type} Compliance Report - ${reg.title}`,
        description: `Compliance analysis for ${reg.regulation_type} regulation`,
        generatedAgo: moment(reg.created_at || new Date()).fromNow(),
        generatedBy: 'System',
        type: 'regulatory',
        data: reg
      });
    });
    
    // Generate vendor reports
    vendors.forEach((vendor, index) => {
      recentReports.push({
        id: `vendor_${vendor.id}`,
        title: `Vendor Compliance Report - ${vendor.company_name}`,
        description: `Compliance score: ${vendor.compliance_score}%`,
        generatedAgo: moment(vendor.last_audit || new Date()).fromNow(),
        generatedBy: 'Compliance Officer',
        type: 'vendor',
        data: vendor
      });
    });
    
    // Sort by most recent
    recentReports.sort((a, b) => new Date(b.generatedAgo) - new Date(a.generatedAgo));
    
    res.json(recentReports.slice(0, 10)); // Return top 10
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get report statistics
router.get('/stats', async (req, res) => {
  try {
    const [regulations] = await db.query('SELECT COUNT(*) as count FROM regulations');
    const [vendors] = await db.query('SELECT COUNT(*) as count FROM vendors');
    const [complianceStats] = await db.query(`
      SELECT 
        AVG(compliance_score) as avg_score,
        COUNT(CASE WHEN compliance_score < 60 THEN 1 END) as at_risk,
        COUNT(CASE WHEN brsr_compliance = 1 THEN 1 END) as brsr_compliant
      FROM vendors
    `);
    
    const [upcomingDeadlines] = await db.query(`
      SELECT COUNT(*) as count 
      FROM regulations 
      WHERE deadline BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    `);
    
    res.json({
      totalRegulations: regulations[0].count,
      totalVendors: vendors[0].count,
      avgComplianceScore: Math.round(complianceStats[0].avg_score || 0),
      atRiskVendors: complianceStats[0].at_risk,
      brsrCompliant: complianceStats[0].brsr_compliant,
      upcomingDeadlines: upcomingDeadlines[0].count
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate report data based on type
async function generateReportData(type) {
  try {
    switch (type) {
      case 'regulatory':
        const [regulations] = await db.query(`
          SELECT 
            regulation_type,
            COUNT(*) as count,
            AVG(CASE WHEN deadline < CURDATE() THEN 1 ELSE 0 END) as overdue_percentage
          FROM regulations 
          GROUP BY regulation_type
        `);
        return {
          type: 'regulatory',
          summary: {
            totalRegulations: regulations.reduce((sum, r) => sum + r.count, 0),
            byType: regulations,
            overduePercentage: regulations.reduce((sum, r) => sum + (r.overdue_percentage * r.count), 0) / regulations.reduce((sum, r) => sum + r.count, 0) * 100
          }
        };
        
      case 'vendor':
        const [vendors] = await db.query(`
          SELECT 
            industry,
            COUNT(*) as count,
            AVG(compliance_score) as avg_score,
            COUNT(CASE WHEN compliance_score < 60 THEN 1 END) as at_risk
          FROM vendors 
          GROUP BY industry
        `);
        const [stateStats] = await db.query(`
          SELECT 
            state,
            COUNT(*) as count,
            AVG(compliance_score) as avg_score
          FROM vendors 
          WHERE state IS NOT NULL
          GROUP BY state
          ORDER BY avg_score DESC
        `);
        return {
          type: 'vendor',
          summary: {
            totalVendors: vendors.reduce((sum, v) => sum + v.count, 0),
            byIndustry: vendors,
            byState: stateStats,
            avgComplianceScore: vendors.reduce((sum, v) => sum + (v.avg_score * v.count), 0) / vendors.reduce((sum, v) => sum + v.count, 0),
            atRiskCount: vendors.reduce((sum, v) => sum + v.at_risk, 0)
          }
        };
        
      case 'brsr':
        const [brsrStats] = await db.query(`
          SELECT 
            COUNT(*) as total_vendors,
            COUNT(CASE WHEN brsr_compliance = 1 THEN 1 END) as compliant,
            AVG(compliance_score) as avg_score,
            COUNT(CASE WHEN compliance_score < 60 THEN 1 END) as at_risk
          FROM vendors
        `);
        return {
          type: 'brsr',
          summary: {
            totalVendors: brsrStats[0].total_vendors,
            compliantCount: brsrStats[0].compliant,
            complianceRate: (brsrStats[0].compliant / brsrStats[0].total_vendors) * 100,
            avgScore: brsrStats[0].avg_score,
            atRiskCount: brsrStats[0].at_risk
          }
        };
        
      default:
        return { type: 'general', summary: {} };
    }
  } catch (error) {
    throw error;
  }
}

// Generate a simple HTML report that can be converted to PDF
function generateReportFile(filePath, reportData, callback) {
  const now = new Date();
  const timestamp = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  
  let reportContent = '';
  
  switch (reportData.type) {
    case 'regulatory':
      reportContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Regulatory Compliance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #1a6d3b; padding-bottom: 10px; }
        .section { margin: 20px 0; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat-box { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>EcoChain India - Regulatory Compliance Report</h1>
        <p>Generated on: ${timestamp}</p>
    </div>
    
    <div class="section">
        <h2>Executive Summary</h2>
        <div class="stats">
            <div class="stat-box">
                <h3>${reportData.summary.totalRegulations}</h3>
                <p>Total Regulations</p>
            </div>
            <div class="stat-box">
                <h3>${reportData.summary.overduePercentage.toFixed(1)}%</h3>
                <p>Overdue Rate</p>
            </div>
        </div>
    </div>
    
    <div class="section">
        <h2>Regulations by Type</h2>
        <table>
            <tr><th>Type</th><th>Count</th><th>Overdue %</th></tr>
            ${reportData.summary.byType.map(r => `
                <tr>
                    <td>${r.regulation_type}</td>
                    <td>${r.count}</td>
                    <td>${(r.overdue_percentage * 100).toFixed(1)}%</td>
                </tr>
            `).join('')}
        </table>
    </div>
</body>
</html>`;
      break;
      
    case 'vendor':
      reportContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Vendor Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #1a6d3b; padding-bottom: 10px; }
        .section { margin: 20px 0; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat-box { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>EcoChain India - Vendor Performance Report</h1>
        <p>Generated on: ${timestamp}</p>
    </div>
    
    <div class="section">
        <h2>Executive Summary</h2>
        <div class="stats">
            <div class="stat-box">
                <h3>${reportData.summary.totalVendors}</h3>
                <p>Total Vendors</p>
            </div>
            <div class="stat-box">
                <h3>${reportData.summary.avgComplianceScore.toFixed(1)}%</h3>
                <p>Avg Compliance</p>
            </div>
            <div class="stat-box">
                <h3>${reportData.summary.atRiskCount}</h3>
                <p>At Risk</p>
            </div>
        </div>
    </div>
    
    <div class="section">
        <h2>Performance by Industry</h2>
        <table>
            <tr><th>Industry</th><th>Count</th><th>Avg Score</th><th>At Risk</th></tr>
            ${reportData.summary.byIndustry.map(v => `
                <tr>
                    <td>${v.industry}</td>
                    <td>${v.count}</td>
                    <td>${v.avg_score ? v.avg_score.toFixed(1) : 0}%</td>
                    <td>${v.at_risk}</td>
                </tr>
            `).join('')}
        </table>
    </div>
    
    <div class="section">
        <h2>Performance by State</h2>
        <table>
            <tr><th>State</th><th>Count</th><th>Avg Score</th></tr>
            ${reportData.summary.byState.map(s => `
                <tr>
                    <td>${s.state}</td>
                    <td>${s.count}</td>
                    <td>${s.avg_score ? s.avg_score.toFixed(1) : 0}%</td>
                </tr>
            `).join('')}
        </table>
    </div>
</body>
</html>`;
      break;
      
    case 'brsr':
      reportContent = `
<!DOCTYPE html>
<html>
<head>
    <title>BRSR Compliance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #1a6d3b; padding-bottom: 10px; }
        .section { margin: 20px 0; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat-box { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .progress { width: 100%; height: 20px; background-color: #f0f0f0; border-radius: 10px; overflow: hidden; }
        .progress-bar { height: 100%; background-color: #28a745; transition: width 0.3s; }
    </style>
</head>
<body>
    <div class="header">
        <h1>EcoChain India - BRSR Compliance Report</h1>
        <p>Generated on: ${timestamp}</p>
    </div>
    
    <div class="section">
        <h2>BRSR Compliance Overview</h2>
        <div class="stats">
            <div class="stat-box">
                <h3>${reportData.summary.totalVendors}</h3>
                <p>Total Vendors</p>
            </div>
            <div class="stat-box">
                <h3>${reportData.summary.compliantCount}</h3>
                <p>BRSR Compliant</p>
            </div>
            <div class="stat-box">
                <h3>${reportData.summary.complianceRate.toFixed(1)}%</h3>
                <p>Compliance Rate</p>
            </div>
            <div class="stat-box">
                <h3>${reportData.summary.avgScore.toFixed(1)}%</h3>
                <p>Avg Score</p>
            </div>
        </div>
        
        <div class="section">
            <h3>Compliance Progress</h3>
            <div class="progress">
                <div class="progress-bar" style="width: ${reportData.summary.complianceRate}%"></div>
            </div>
            <p>${reportData.summary.complianceRate.toFixed(1)}% of vendors are BRSR compliant</p>
        </div>
    </div>
</body>
</html>`;
      break;
      
    default:
      reportContent = `
<!DOCTYPE html>
<html>
<head>
    <title>General Compliance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #1a6d3b; padding-bottom: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>EcoChain India - General Compliance Report</h1>
        <p>Generated on: ${timestamp}</p>
    </div>
    <p>This is a general compliance report. Please specify a report type for detailed analysis.</p>
</body>
</html>`;
  }
  
  fs.writeFile(filePath, reportContent, callback);
}

router.get('/download', async (req, res) => {
  try {
    const { type = 'general', id } = req.query;
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
    
    let filename, reportData;
    
    if (id) {
      // Download specific report by ID
      const [reports] = await db.query('SELECT * FROM reports WHERE id = ?', [id]);
      if (reports.length === 0) {
        return res.status(404).json({ message: 'Report not found' });
      }
      filename = `report_${id}_${timestamp}.html`;
      reportData = { type: 'specific', summary: reports[0] };
    } else {
      // Generate new report based on type
      reportData = await generateReportData(type);
      filename = `${type}_compliance_report_${timestamp}.html`;
    }
    
    const tempPath = path.join(__dirname, '../reports/', filename);
    
    generateReportFile(tempPath, reportData, (err) => {
      if (err) {
        console.error('Report generation error:', err);
        return res.status(500).send('Could not generate the report.');
      }
      
      // Set proper headers for HTML file
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Send the file
      res.sendFile(tempPath, (err) => {
        // Optionally delete the temp file after sending
        fs.unlink(tempPath, () => {});
        if (err) {
          console.error('File send error:', err);
        }
      });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
