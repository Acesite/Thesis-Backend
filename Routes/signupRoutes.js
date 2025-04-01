const express = require("express");
const router = express.Router();
const { signup } = require("../Controllers/signupController");

router.post("/signup", signup);

module.exports = router;
