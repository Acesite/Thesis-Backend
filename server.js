const express = require("express");
const cors = require("cors");
const userRoutes = require("./Routes/signupRoutes");
const loginRoutes = require("./Routes/loginRoutes");
const manageAccountRoutes = require("./Routes/manageaccountRoutes");
const cropsRoutes = require("./Routes/cropsRoutes");
const manageCropRoutes = require("./Routes/managecropRoutes");
const manageProfileRoutes = require("./Routes/manageprofileRoutes");
const graphRoutes = require("./Routes/graphRoutes");
const farmersProfileRoutes = require("./Routes/FarmersProfileRoutes");
const farmerLoginRoutes = require('./Routes/loginFarmerRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const fileUpload = require("express-fileupload");

// Middleware
app.use(cors());
app.use(express.json()); // Parse incoming JSON data
app.use(fileUpload());

app.use("/uploads", express.static("uploads")); 
// Routes
app.use("/", userRoutes); // Routes for sign up
app.use("/users", loginRoutes); // Routes for Logging in
app.use("/manageaccount", manageAccountRoutes);  // Routes for Managing Account
app.use("/api/crops", cropsRoutes);
app.use("/api/managecrops", manageCropRoutes);
app.use("/api", manageProfileRoutes);
app.use("/api/graphs", graphRoutes); 
app.use("/api/farmers", farmersProfileRoutes);
app.use('/api/farmers', farmerLoginRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
