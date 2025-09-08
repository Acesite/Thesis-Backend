const express = require("express");
const router = express.Router();
const { signup } = require("../../Controllers/Signup/signupController");

router.post("/signup", signup);

module.exports = router;
