const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../Config/db'); // Database connection

// Controllers/Login/loginController.js
const login = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const sql = `
    SELECT
      u.id,
      u.role,
      u.first_name,
      u.last_name,
      u.email,
      COALESCE(u.profile_picture, '') AS profile_picture,  -- ← never null
      u.password,
      u.status
    FROM tbl_users u
    WHERE u.email = ?
    LIMIT 1
  `;

  db.query(sql, [email], (err, rows) => {
    if (err) return res.status(500).json({ message: "Internal Server Error" });
    if (!rows.length) return res.status(401).json({ message: "Invalid email or password" });

    const user = rows[0];

    if (user.status === "Pending")   return res.status(403).json({ message: "Your account is pending approval. Please contact support." });
    if (user.status === "Declined")  return res.status(403).json({ message: "Your account has been declined. Please contact support for further information." });

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) return res.status(500).json({ message: "Internal Server Error" });
      if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });

      const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

      res.status(200).json({
        success: true,
        token,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_picture: user.profile_picture, // now guaranteed string ('' if none)
        email: user.email,
        id: user.id,
      });
    });
  });
};



module.exports = { login };
