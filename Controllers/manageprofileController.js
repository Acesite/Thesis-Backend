const db = require("../Config/db");
const bcrypt = require("bcryptjs");

const updateAccountProfile = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, email, password } = req.body;

  try {
    let query = "UPDATE tbl_users SET first_name = ?, last_name = ?, email = ?";
    const params = [first_name, last_name, email];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ", password = ?";
      params.push(hashedPassword);
    }

    query += " WHERE id = ?";
    params.push(id);

    db.query(query, params, (err, result) => {
      if (err) {
        console.error("Error updating account profile:", err);
        return res.status(500).json({ error: "Database error" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.status(200).json({ message: "Profile updated successfully" });
    });
  } catch (err) {
    console.error("Error during password hashing:", err);
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