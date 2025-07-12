// backend/routes/demo.js
const express = require('express');
const router = express.Router();

router.post('/schedule', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }
    // Here you would add logic to save the request, send an email, etc.
    console.log(`Demo scheduled for: ${email}`);
    res.json({ message: 'Demo scheduled! We will contact you soon.' });
});

module.exports = router;
