const db = require("../../Config/db");

// Fetch all user accounts
const getAllAccounts = (req, res) => {
  const sql = "SELECT * FROM tbl_users";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching accounts:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
};

// Delete a user account
const deleteAccount = (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM tbl_users WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error deleting account:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Account not found" });
    }
    res.status(200).json({ message: "Account deleted successfully" });
  });
};

const updateAccountStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const sql = "UPDATE tbl_users SET status = ? WHERE id = ?"; 
  db.query(sql, [status, id], (err, result) => {
    if (err) {
      console.error("Error updating account status:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Account not found" });
    }
    res.status(200).json({ message: `Account ${status.toLowerCase()} successfully` });
  });
};


module.exports = { getAllAccounts, deleteAccount, updateAccountStatus,};



