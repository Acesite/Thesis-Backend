const express = require("express");
const router = express.Router();
const cropsController = require("../Controllers/cropsController");

router.post("/", cropsController.createCrop);
router.get("/", cropsController.getCrops); 
router.get("/polygons", cropsController.getAllPolygons); // move this ABOVE `/:id`
router.get("/:id", cropsController.getCropById);



module.exports = router;
