const express = require("express");
const router = express.Router();
const { getAccountById, updateAccountProfile } = require("../../Controllers/Account/manageprofileController");

router.get("/profile/:id", getAccountById);
router.put("/profile/:id", updateAccountProfile);

module.exports = router;
