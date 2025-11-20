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

// polygons
router.get("/polygons", cropsController.getAllPolygons);

// simple farmer list (useful for dropdowns)
router.get("/farmers", async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        `SELECT farmer_id, first_name, last_name, barangay,
                COALESCE(NULLIF(full_address,''), '') AS full_address
         FROM tbl_farmers
         ORDER BY first_name, last_name`
      );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Failed to fetch farmers:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ecosystems (PUT THIS BEFORE "/:id")
router.get(
  "/ecosystems/:crop_type_id",
  cropsController.getEcosystemsByCropType
);

// list and detail
router.get("/", cropsController.getCrops);
router.get("/:id", cropsController.getCropById);

// ✅ Harvest route — DO NOT prefix with /api/crops here
router.patch("/:id/harvest", cropsController.markCropHarvested);

module.exports = router;
