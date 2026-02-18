// server/Routes/Dar/DarRoutes.js
const express = require("express");
const router = express.Router();

const DarController = require("../../Controllers/Dar/DarController");

router.get("/arbs", DarController.getAllArbs);
router.get("/arbs/:arb_id", DarController.getArbById);
router.post("/arbs", DarController.createArb);
router.put("/arbs/:arb_id", DarController.updateArb);
router.put("/arbs/:arb_id/geotag", DarController.updateArbGeotag);
router.delete("/arbs/:arb_id", DarController.deleteArb);

module.exports = router;
