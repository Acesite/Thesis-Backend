const db = require("../../Config/db");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");

const updateAccountProfile = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, email, password } = req.body;

  try {
    // Start building UPDATE
    const updates = [];
    const params = [];

    if (typeof first_name === "string") {
      updates.push("first_name = ?");
      params.push(first_name.trim());
    }
    if (typeof last_name === "string") {
      updates.push("last_name = ?");
      params.push(last_name.trim());
    }
    if (typeof email === "string") {
      updates.push("email = ?");
      params.push(email.trim());
    }

    // Handle optional password
    if (password && password.trim()) {
      const hashed = await bcrypt.hash(password.trim(), 10);
      updates.push("password = ?");
      params.push(hashed);
    }

    // Fetch current row (to optionally remove old photo)
    const [current] = await new Promise((resolve, reject) => {
      db.query("SELECT * FROM tbl_users WHERE id = ? LIMIT 1", [id], (err, rows) =>
        err ? reject(err) : resolve(rows || [])
      );
    });

    if (!current) return res.status(404).json({ message: "Account not found" });

    // Handle file upload if present (express-fileupload)
    let newProfilePath = null;
    if (req.files && req.files.profile_picture) {
      const file = req.files.profile_picture;

      // Basic type check
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.mimetype)) {
        return res.status(400).json({ error: "Invalid image type. Use JPG, PNG, or WEBP." });
      }

      // ✅ FIX: correct absolute folder path (projectRoot/uploads/profilePictures)
      const uploadDir = path.join(__dirname, "../../uploads/profilePictures");
      await fs.promises.mkdir(uploadDir, { recursive: true });

      // sanitize filename
      const safeName = String(file.name).replace(/[^\w.-]/g, "_");
      const filename = `${Date.now()}_${safeName}`;
      const savePath = path.join(uploadDir, filename);

      await file.mv(savePath);

      // DB/web path to return & store
      newProfilePath = `/uploads/profilePictures/${filename}`;
      updates.push("profile_picture = ?");
      params.push(newProfilePath);

      // Optional: delete old file if it was inside /uploads/
      if (current.profile_picture && /^\/?uploads\//i.test(current.profile_picture)) {
        const oldFsPath = path.join(
          __dirname,
          "../../",
          current.profile_picture.replace(/^\//, "")
        );
        fs.promises.unlink(oldFsPath).catch(() => {}); // ignore if missing
      }
    }

    if (!updates.length) {
      return res.status(400).json({ message: "No changes provided" });
    }

    // Finalize and run UPDATE
    const sql = `UPDATE tbl_users SET ${updates.join(", ")} WHERE id = ?`;
    params.push(id);

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error("❌ DB update failed:", err);
        return res.status(500).json({ error: "Database error" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Account not found" });
      }

      res.status(200).json({
        message: "Profile updated successfully",
        profile_picture: newProfilePath || null,         // send new path if changed
        profile_picture_ver: Date.now().toString(),      // cache-buster
      });
    });
  } catch (err) {
    console.error("❌ Error updating profile:", err);
    res.status(500).json({ error: "Server error" });
  }
};

const getAccountById = (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM tbl_users WHERE id = ?";
  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error fetching account by ID:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (!results.length) return res.status(404).json({ message: "Account not found" });
    res.status(200).json(results[0]);
  });
};

module.exports = { updateAccountProfile, getAccountById };
