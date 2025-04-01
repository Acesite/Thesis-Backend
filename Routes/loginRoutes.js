const express = require('express');
const { login } = require('../Controllers/loginController'); // Assuming your login controller is in the Controllers folder

const router = express.Router();

// POST request to handle user login
router.post('/login', login);

module.exports = router;
