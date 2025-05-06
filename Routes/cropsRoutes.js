const express = require("express");
const router = express.Router();
const cropsController = require("../Controllers/cropsController");

router.post("/", cropsController.createCrop);
router.get("/", cropsController.getCrops); 
router.get("/:id", cropsController.getCropById); 
router.get("/polygons", cropsController.getAllPolygons);


module.exports = router;
