const db = require("../../Config/db");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");


const updateAccountProfile = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, email, password } = req.body;

  try {
    const params = [first_name, last_name, email];
    let query = "UPDATE tbl_users SET first_name = ?, last_name = ?, email = ?";
    let profile_picture = null;

    // ✅ Handle file upload if exists
    if (req.files && req.files.profile_picture) {
      const file = req.files.profile_picture;
      const uploadDir = path.join(__dirname, "../uploads/profilePictures");

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `${Date.now()}_${file.name.replace(/\s+/g, "")}`;
      const filepath = path.join(uploadDir, filename);
      profile_picture = `/uploads/profilePictures/${filename}`;

      try {
        await file.mv(filepath);
        query += ", profile_picture = ?";
        params.push(profile_picture);
      } catch (err) {
        console.error("❌ Error saving profile picture:", err);
        return res.status(500).json({ error: "File upload failed" });
      }
    }

    // ✅ Handle password update if provided
    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ", password = ?";
      params.push(hashedPassword);
    }

    query += " WHERE id = ?";
    params.push(id);

    db.query(query, params, (err, result) => {
      if (err) {
        console.error("❌ DB update failed:", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Account not found" });
      }

      res.status(200).json({
        message: "Profile updated successfully",
        profile_picture: profile_picture || null,
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
    if (results.length === 0) {
      return res.status(404).json({ message: "Account not found" });
    }
    res.status(200).json(results[0]);
  });
};
module.exports = { updateAccountProfile, getAccountById };