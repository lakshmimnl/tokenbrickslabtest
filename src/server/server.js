const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression and logging
app.use(compression());
app.use(morgan('combined'));

// Routes
app.use('/api/assets', require('./routes/assets'));
app.use('/api/validators', require('./routes/validators'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ipfs', require('./routes/ipfs'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
  console.log('Health check endpoint accessed at', new Date().toISOString());
});

// Read the public USDC contract state through Ethereum mainnet.
app.get('/api/LakshApiTest', async (req, res) => {
  const contractAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const contractAbi = ['function totalSupply() view returns (uint256)'];
  const rpcUrl = process.env.ETHEREUM_RPC_URL || 'https://eth.drpc.org';

  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, contractAbi, provider);
    const totalSupply = await Promise.race([
      contract.totalSupply(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Blockchain RPC request timed out')), 10000);
      })
    ]);
    const result = {
      contractAddress,
      network: 'Ethereum mainnet',
      totalSupply: ethers.utils.formatUnits(totalSupply, 6),
      fetchedAt: new Date().toISOString()
    };

    console.log('LakshApiTest smart contract result:', result);
    res.json(result);
  } catch (error) {
    console.error('LakshApiTest smart contract request failed:', error.message);
    res.status(502).json({
      error: 'Unable to fetch smart contract data',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
