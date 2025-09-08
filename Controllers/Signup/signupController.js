const bcrypt = require("bcrypt");
const db = require("../../Config/db");
const path = require("path");
const fs = require("fs");

const signup = async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const profile_picture_file = req.files?.profile_picture;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  let profile_picture = null;

  if (profile_picture_file) {
    const uploadDir = path.join(__dirname, "../uploads/profilePictures");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filename = `${Date.now()}_${profile_picture_file.name.replace(/\s+/g, "")}`;
    const filepath = path.join(uploadDir, filename);
    profile_picture = `/uploads/profilePictures/${filename}`;

    try {
      await profile_picture_file.mv(filepath);
    } catch (err) {
      console.error("File upload error:", err);
      return res.status(500).json({ message: "Profile picture upload failed" });
    }
  }

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      console.error("Error hashing password:", err);
      return res.status(500).json({ message: "Error creating user" });
    }

    const query = `
      INSERT INTO tbl_users (first_name, last_name, email, password, profile_picture)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(query, [firstName, lastName, email, hashedPassword, profile_picture], (err, result) => {
      if (err) {
        console.error("Error inserting user:", err);
        return res.status(500).json({ message: "Database error" });
      }

      res.status(201).json({ success: true, message: "User created successfully!" });
    });
  });
};

module.exports = { signup };
