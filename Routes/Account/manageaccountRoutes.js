const express = require("express");
const router = express.Router();
const { getAllAccounts, deleteAccount, updateAccountStatus } = require("../../Controllers/Account/manageaccountController");

// Fetch all accounts
router.get("/accounts", getAllAccounts);

// Delete account by ID
router.delete("/accounts/:id", deleteAccount);

// Update account status by ID
router.put("/accounts/:id/status", updateAccountStatus);


module.exports = router;
