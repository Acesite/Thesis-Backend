// Routes/Crops/cropsRoutes.js
const express = require("express");
const router = express.Router();

const db = require("../../Config/db"); // for /farmers
const cropsController = require("../../Controllers/Crops/cropsController");

// create
router.post("/", cropsController.createCrop);

// taxonomies
router.get("/types", cropsController.getCropTypes);
router.get("/varieties/:crop_type_id", cropsController.getCropVarietiesByType);

// ecosystems (PUT THIS BEFORE "/:id")
router.get("/ecosystems/:crop_type_id", cropsController.getEcosystemsByCropType);

// 🔹 tenure types
router.get("/tenure-types", cropsController.getTenureTypes);

// polygons
router.get("/polygons", cropsController.getAllPolygons);

// simple farmer list (useful for dropdowns)
router.get("/farmers", async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        `SELECT farmer_id, first_name, last_name, barangay,
                COALESCE(NULLIF(full_address,''), '') AS full_address,
                tenure_id
         FROM tbl_farmers
         ORDER BY first_name, last_name`
      );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Failed to fetch farmers:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// list and detail
router.get("/", cropsController.getCrops);
router.get("/:id", cropsController.getCropById);

// ✅ Harvest route
router.patch("/:id/harvest", cropsController.markCropHarvested);
router.get("/:id/history", cropsController.getCropHistory);

module.exports = router;
