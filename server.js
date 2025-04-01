const express = require("express");
const cors = require("cors");
const userRoutes = require("./Routes/signupRoutes");
const loginRoutes = require("./Routes/loginRoutes");
const manageAccountRoutes = require("./Routes/manageaccountRoutes");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json()); // Parse incoming JSON data

// Routes
app.use("/", userRoutes); // Routes for sign up
app.use("/users", loginRoutes); // Routes for Logging in
app.use("/manageaccount", manageAccountRoutes);  // Routes for Managing Account

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
