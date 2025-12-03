const express = require("express");
const router = express.Router();
const ctrl = require("../../Controllers/Calamity/managecalamityController");

// specific first
router.get("/types", ctrl.listDistinctTypes);
router.get("/types/distinct/all", ctrl.listDistinctTypes);
router.get("/crop-types", ctrl.listCropTypes);
router.get("/crop-varieties", ctrl.listCropVarieties);
router.get("/ecosystems", ctrl.listEcosystems);

// list
router.get("/", ctrl.listCalamities);

// CRUD (dynamic last)
router.get("/:id", ctrl.getCalamityById);
router.post("/", ctrl.createCalamity);
router.put("/:id", ctrl.updateCalamity);
router.delete("/:id", ctrl.deleteCalamity);

router.get("/:id/farmers", ctrl.listCalamityFarmers);
router.put("/:id/farmers/:farmerId", ctrl.updateCalamityFarmer);

module.exports = router;
