const bcrypt = require("bcrypt");
const db = require("../../Config/db");
const path = require("path");
const fs = require("fs");

const signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const profile_picture_file = req.files?.profile_picture; // <-- be sure your client field is "profile_picture"

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let profile_picture = null;

    if (profile_picture_file) {
      // Validate (optional but recommended)
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(profile_picture_file.mimetype)) {
        return res.status(400).json({ message: "Only JPG/PNG/WebP are allowed" });
      }
      const MAX = 5 * 1024 * 1024; // 5MB
      if (profile_picture_file.size > MAX) {
        return res.status(400).json({ message: "File too large (max 5MB)" });
      }

      // IMPORTANT: point to the same /uploads you serve in server.js
      const uploadDir = path.join(process.cwd(), "uploads", "profilePictures");
      await fs.promises.mkdir(uploadDir, { recursive: true });

      const ext = path.extname(profile_picture_file.name).toLowerCase();
      const base = path
        .basename(profile_picture_file.name, ext)
        .replace(/[^a-z0-9_-]/gi, "");
      const filename = `${Date.now()}_${base || "avatar"}${ext}`;
      const filepath = path.join(uploadDir, filename);

      // Save the file to disk
      await profile_picture_file.mv(filepath);

      // Public path that matches: app.use("/uploads", express.static("uploads"))
      profile_picture = `/uploads/profilePictures/${filename}`;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO tbl_users (first_name, last_name, email, password, profile_picture)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
      query,
      [firstName, lastName, email, hashedPassword, profile_picture],
      (err) => {
        if (err) {
          console.error("Error inserting user:", err);
          return res.status(500).json({ message: "Database error" });
        }
        return res
          .status(201)
          .json({ success: true, message: "User created successfully!", profile_picture });
      }
    );
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { signup };
