const express = require('express');
const { loginFarmer } = require('../../Controllers/Login/loginFarmerController');

const router = express.Router();

// POST /api/farmers/login
router.post('/login', loginFarmer);

module.exports = router;
