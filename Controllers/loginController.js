const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../Config/db'); // Database connection

const login = (req, res) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
  }

  // Find the user by email
  const query = `SELECT * FROM tbl_users WHERE email = ?`;
  db.query(query, [email], (err, result) => {
      if (err) {
          console.error("Error fetching user:", err);
          return res.status(500).json({ message: "Internal Server Error" });
      }

      if (result.length === 0) {
          return res.status(401).json({ message: "Invalid email or password" });
      }

      const user = result[0];

      // Check user status
      if (user.status === "Pending") {
          return res.status(403).json({ message: "Your account is pending approval. Please contact support." });
      } else if (user.status === "Declined") {
          return res.status(403).json({ message: "Your account has been declined. Please contact support for further information." });
      }

      // Compare the hashed password
      bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) {
              console.error("Error comparing passwords:", err);
              return res.status(500).json({ message: "Internal Server Error" });
          }

          if (!isMatch) {
              return res.status(401).json({ message: "Invalid email or password" });
          }

          // User authenticated successfully
          const token = jwt.sign(
              { userId: user.id, role: user.role },
              process.env.JWT_SECRET,
              { expiresIn: '1h' }
          );

          res.status(200).json({ 
  success: true, 
  token, 
  role: user.role,
  first_name: user.first_name,
  last_name: user.last_name
});

      });
  });
};


module.exports = { login };
