// Add this to the top with other imports
const express = require('express');
const router = express.Router();
const farmersController = require('../../Controllers/Farmers/FarmersProfileController');

// ✅ Add farmer registration
router.post('/signup-farmer', farmersController.registerFarmer);

// Existing routes...
router.get('/:id', farmersController.getFarmerProfile);
router.put('/update-info/:id', farmersController.updateFarmerProfile);
router.put('/update-password/:id', farmersController.updateFarmerPassword);
router.put('/update-picture/:id', farmersController.updateProfilePicture);

module.exports = router;
