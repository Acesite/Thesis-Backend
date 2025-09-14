const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../Config/db'); // adjust if path differs

const loginFarmer = (req, res) => {
  const { mobile_number, password } = req.body;

  // Basic validation
  if (!mobile_number || !password) {
    return res.status(400).json({ message: "Mobile number and password are required" });
  }

  // Find the farmer by mobile number
  const query = `SELECT * FROM tbl_farmers WHERE mobile_number = ?`;
  db.query(query, [mobile_number], (err, result) => {
    if (err) {
      console.error("Error fetching farmer:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }

    if (result.length === 0) {
      return res.status(401).json({ message: "Invalid mobile number or password" });
    }

    const farmer = result[0];
    console.log("Fetched Farmer:", farmer);

    // Check farmer status (if you have a status column like in tbl_users)
    if (farmer.status === "Pending") {
      return res.status(403).json({ message: "Your account is pending approval. Please contact support." });
    } else if (farmer.status === "Declined") {
      return res.status(403).json({ message: "Your account has been declined. Please contact support." });
    }

    // Compare password
    bcrypt.compare(password, farmer.password, (err, isMatch) => { 
      if (err) {
        console.error("Error comparing passwords:", err);
        return res.status(500).json({ message: "Internal Server Error" });
      }

      if (!isMatch) {
        return res.status(401).json({ message: "Invalid mobile number or password" });
      }

     // Farmer authenticated successfully
      const token = jwt.sign(
        { userId: farmer.farmer_id, role: farmer.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

     res.status(200).json({
  success: true,
  token,
  role: farmer.role || "farmer",
  first_name: farmer.first_name,
  last_name: farmer.last_name,
  profile_picture: farmer.profile_picture,
  farmer_id: farmer.farmer_id
});

    });
  });
};

module.exports = { loginFarmer };
