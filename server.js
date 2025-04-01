const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors()); // Allow frontend to call the backend
app.use(express.json()); // Parse JSON requests

// Example route: Fetch data from an external API using Axios
app.get("/api/posts", async (req, res) => {
  try {
    const response = await axios.get("https://jsonplaceholder.typicode.com/posts");
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching data" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
