const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/oauth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing authorization code");

  try {
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        code,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        redirect_uri: process.env.ZOHO_REDIRECT_URI,
        grant_type: 'authorization_code'
      }
    });

    const { access_token, refresh_token } = response.data;
    console.log("✅ Tokens received:", response.data);

    res.send("Zoho tokens received. Store them securely.");
  } catch (error) {
    console.error("❌ Error fetching tokens:", error.message);
    res.status(500).send("Failed to retrieve tokens");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
