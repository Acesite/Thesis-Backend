// THESIS-BACKEND/server.js
const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
require("dotenv").config();
const path = require("path");

// ──────────────────────────────────────────────────────────
// 1) Core App
// ──────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ createParentPath: true }));

// Serve uploaded files (keep this)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ──────────────────────────────────────────────────────────
/* 2) API Routes (your existing routers) */
// ──────────────────────────────────────────────────────────
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
const manageCalamityRoutes = require("./Routes/Calamity/managecalamityRoutes");
const archiveRoutes = require("./Routes/Archive/archiveRoutes");
const calamityRadiusRoutes = require('./Routes/Calamity/calamityradiusRoutes');
const manageImpactRoutes = require("./Routes/Calamity/manageimpactRoutes"); // ✅


// Optional: health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

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
app.use("/api/managecalamities", manageCalamityRoutes);
app.use("/api/archive", archiveRoutes);
app.use('/api/calamityradius', calamityRadiusRoutes);
app.use("/api/impacts", manageImpactRoutes);



// ──────────────────────────────────────────────────────────
/* 3) Serve the React build from the sibling folder */
// ──────────────────────────────────────────────────────────
// NOTE: This path is case-sensitive on Linux. Match your folder name exactly.
const clientBuild = path.join(__dirname, "..", "THESIS-FRONTEND", "build");

// Serve static assets from React build
app.use(express.static(clientBuild));

// SPA fallback: any non-API route returns index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(clientBuild, 'index.html'));
});


// or ✅ option B: regex pattern
app.get(/.*/, (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(clientBuild, "index.html"));
});

// ──────────────────────────────────────────────────────────
// 4) Error handler
// ──────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// ──────────────────────────────────────────────────────────
// 5) Start
// ──────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
  