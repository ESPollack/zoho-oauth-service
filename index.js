const express = require('express');
const axios = require('axios');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const app = express();
const secretClient = new SecretManagerServiceClient();
const PORT = process.env.PORT || 8080;

// Fetch secret by name
async function getSecret(secretName) {
  const [version] = await secretClient.accessSecretVersion({
    name: `projects/zoho-gpt-integration/secrets/${secretName}/versions/latest`,
  });
  return version.payload.data.toString('utf8');
}

app.get('/oauth/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).send("Missing authorization code");

  try {
    // 🔐 Securely fetch secrets
    const client_id = await getSecret('ZOHO_CLIENT_ID');
    const client_secret = await getSecret('ZOHO_CLIENT_SECRET');
    const redirect_uri = await getSecret('ZOHO_REDIRECT_URI');

    // 🔁 Exchange code for tokens
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        code,
        client_id,
        client_secret,
        redirect_uri,
        grant_type: 'authorization_code',
      },
    });

    const { access_token, refresh_token } = response.data;

    console.log('✅ Zoho tokens received:', { access_token, refresh_token });

    res.send("Zoho tokens received. Store them securely.");
  } catch (error) {
    console.error('❌ Error exchanging token:', error.message);
    res.status(500).send("OAuth failed.");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 App listening on port ${PORT}`);
});


