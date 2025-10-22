const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
require("dotenv").config();

// Routes
const userRoutes = require("./Routes/Signup/signupRoutes");
const loginRoutes = require("./Routes/Login/loginRoutes");
const manageAccountRoutes = require("./Routes/Account/manageaccountRoutes");
const cropsRoutes = require("./Routes/Crops/cropsRoutes");
const manageCropRoutes = require("./Routes/Crops/managecropRoutes");
const manageProfileRoutes = require("./Routes/Account/manageprofileRoutes");
const graphRoutes = require("./Routes/Graph/graphRoutes");
const farmersProfileRoutes = require("./Routes/Farmers/FarmersProfileRoutes");
const farmerLoginRoutes = require("./Routes/Login/loginFarmerRoutes");
const calamityRoutes = require("./Routes/Calamity/calamityRoutes");
const manageCalamityRoutes = require("./Routes/Calamity/managecalamityRoutes"); // ✅ keep this
// ⛔ remove the stray 'q' line here

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ createParentPath: true }));

// Static
app.use("/uploads", express.static("uploads"));

// Mount routers
app.use("/", userRoutes);
app.use("/users", loginRoutes);
app.use("/manageaccount", manageAccountRoutes);
app.use("/api/crops", cropsRoutes);
app.use("/api/managecrops", manageCropRoutes);
app.use("/api", manageProfileRoutes);
app.use("/api/graphs", graphRoutes);
app.use("/api/farmers", farmersProfileRoutes);
app.use("/api/farmers", farmerLoginRoutes);
app.use("/api/calamities", calamityRoutes);
app.use("/api/managecalamities", manageCalamityRoutes); // ✅ this now hits the right controller

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
;