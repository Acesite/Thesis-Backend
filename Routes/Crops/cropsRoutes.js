const express = require("express");
const router = express.Router();
const cropsController = require("../../Controllers/Crops/cropsController");

router.post("/", cropsController.createCrop);
router.get("/types", cropsController.getCropTypes); 
router.get("/polygons", cropsController.getAllPolygons);
router.get("/", cropsController.getCrops);
router.get("/:id", cropsController.getCropById); 
router.get("/varieties/:crop_type_id", cropsController.getCropVarietiesByType);
router.get("/farmers", async (req, res) => {
    try {
        const [rows] = await db.promise().query("SELECT farmer_id, first_name, last_name FROM tbl_farmers");
        res.status(200).json(rows);
    } catch (err) {
        console.error("Failed to fetch farmers:", err);
        res.status(500).json({ message: "Server error" });
    }
});




module.exports = router;
