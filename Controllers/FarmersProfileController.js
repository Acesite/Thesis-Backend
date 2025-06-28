const db = require("../Config/db");
const bcrypt = require('bcrypt');


// ✅ Register New Farmer
exports.registerFarmer = async (req, res) => {
    const {
      first_name,
      last_name,
      middle_name,
      extension_name,
      no_middle_name,
      no_extension_name,
      sex,
      mobile_number,
      password,
      house_number,
      street,
      barangay,
      city,
      province,
      region
    } = req.body;
  
    try {
      // ✅ Handle profile picture
      let profile_picture = null;
      if (req.files && req.files.profile_picture) {
        const file = req.files.profile_picture;
        const uploadPath = `uploads/profilePictures/${Date.now()}_${file.name}`;
  
        // Move the file to the uploads directory
        file.mv(uploadPath, (err) => {
          if (err) {
            console.error("❌ Failed to save profile picture:", err);
            return res.status(500).json({ error: "Failed to save profile picture" });
          }
        });
  
        profile_picture = uploadPath;
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const query = `
        INSERT INTO tbl_farmers (
          first_name, last_name, middle_name, extension_name,
          no_middle_name, no_extension_name, sex, mobile_number,
          password, house_number, street, barangay, city, province, region,
          profile_picture
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
  
      const values = [
        first_name, last_name, middle_name, extension_name,
        no_middle_name, no_extension_name, sex, mobile_number,
        hashedPassword, house_number, street, barangay, city, province, region,
        profile_picture
      ];
  
      db.query(query, values, (err, result) => {
        if (err) {
          console.error("❌ Error inserting farmer:", err);
          return res.status(500).json({ error: "Database error" });
        }
  
        res.status(201).json({ success: true, message: "Farmer registered successfully!" });
      });
    } catch (error) {
      console.error("❌ Server error during farmer registration:", error);
      res.status(500).json({ error: "Server error" });
    }
  };
  
  
// Get Farmer Profile
exports.getFarmerProfile = (req, res) => {
  const farmerId = req.params.id;
  const query = 'SELECT * FROM tbl_farmers WHERE farmer_id = ?';

  db.query(query, [farmerId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json(result[0]);
  });
};

// Update Farmer Profile Info (excluding password & picture)
exports.updateFarmerProfile = (req, res) => {
  const farmerId = req.params.id;
  const {
    first_name, last_name, middle_name, extension_name,
    no_middle_name, no_extension_name, sex, mobile_number,
    house_number, street, barangay
  } = req.body;

  const query = `
    UPDATE tbl_farmers 
    SET first_name = ?, last_name = ?, middle_name = ?, extension_name = ?,
        no_middle_name = ?, no_extension_name = ?, sex = ?, mobile_number = ?,
        house_number = ?, street = ?, barangay = ?
    WHERE farmer_id = ?`;

  db.query(query, [
    first_name, last_name, middle_name, extension_name,
    no_middle_name, no_extension_name, sex, mobile_number,
    house_number, street, barangay, farmerId
  ], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Profile updated successfully." });
  });
};

// Update Password
exports.updateFarmerPassword = async (req, res) => {
  const farmerId = req.params.id;
  const { password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'UPDATE tbl_farmers SET password = ? WHERE farmer_id = ?';

    db.query(query, [hashedPassword, farmerId], (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: "Password updated successfully." });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update Profile Picture
exports.updateProfilePicture = (req, res) => {
  const farmerId = req.params.id;
  const profile_picture = req.file.filename;

  const query = 'UPDATE tbl_farmers SET profile_picture = ? WHERE farmer_id = ?';

  db.query(query, [profile_picture, farmerId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Profile picture updated successfully." });
  });
};
