require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors'); // <-- Add this line
const app = express();
const corsOptions = {
  origin: '*', // Allow all origins (for development only)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Import routes
const regulationRoutes = require('./routes/regulations');
const vendorRoutes = require('./routes/vendors');
const reportsRouter = require('./routes/reports');
const demoRouter = require('./routes/demo');
app.use('/api/regulations', regulationRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/reports', reportsRouter);
app.use('/api/demo', demoRouter);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Indian Timezone: ${process.env.TZ}`);
});