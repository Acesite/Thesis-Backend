const bcrypt = require('bcrypt');
const db = require('../Config/db'); // Make sure your database connection is set up correctly

const signup = (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  // Basic validation
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Hash the password
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      console.error("Error hashing password:", err);
      return res.status(500).json({ message: "Error creating user, please try again" });
    }

    // Save the user with the hashed password
    const query = `INSERT INTO tbl_users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)`;

    db.query(query, [firstName, lastName, email, hashedPassword], (err, result) => {
      if (err) {
        console.error("Error inserting user:", err);
        return res.status(500).json({ message: "Error creating user, please try again" });
      }
      res.status(201).json({ success: true, message: "User created successfully!" });
    });
  });
};

module.exports = { signup };
