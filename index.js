const express = require('express');
const axios = require('axios');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const app = express();
const port = process.env.PORT || 8080;
const secretClient = new SecretManagerServiceClient();

// Helper: Load secret from Secret Manager
async function getSecret(secretName) {
  const [version] = await secretClient.accessSecretVersion({
    name: `projects/zoho-gpt-integration/secrets/${secretName}/versions/latest`,
  });
  return version.payload.data.toString('utf8');
}

// ========== ROUTE: OAuth callback from Zoho ==========
app.get('/oauth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing authorization code");

  try {
    const client_id = await getSecret('ZOHO_CLIENT_ID');
    const client_secret = await getSecret('ZOHO_CLIENT_SECRET');
    const redirect_uri = await getSecret('ZOHO_REDIRECT_URI');

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
  } catch (err) {
    console.error('❌ OAuth Error:', err.message);
    res.status(500).send("OAuth failed.");
  }
});

// ========== ROUTE: Get candidate summary ==========
app.get('/candidate-summary', async (req, res) => {
  try {
    const accessToken = await getSecret('ZOHO_ACCESS_TOKEN');
    const gptKey = await getSecret('GPT_API_KEY');

    const candidates = await getCandidateData(accessToken);
    if (!candidates || candidates.length === 0) {
      return res.status(404).send("No candidates found.");
    }

    const prompt = buildPromptFromCandidate(candidates[0]);
    const summary = await getGPTSummary(prompt, gptKey);

    res.json({ summary });
  } catch (err) {
    console.error("❌ Summary Error:", err.message);
    res.status(500).send("Failed to generate summary.");
  }
});

// Helper: Fetch candidates from Zoho
async function getCandidateData(accessToken) {
  const response = await axios.get('https://recruit.zoho.com/recruit/v2/Candidates', {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    }
  });
  return response.data.data;
}

// Helper: Build GPT prompt from candidate info
function buildPromptFromCandidate(candidate) {
  return `
Summarize this candidate for a recruiter:

Name: ${candidate.First_Name || ''} ${candidate.Last_Name || ''}
Email: ${candidate.Email || 'N/A'}
Resume Summary: ${candidate.Resume || 'No resume available'}

Format as a short summary paragraph with bullet points for skills.
  `;
}

// Helper: Call OpenAI GPT
async function getGPTSummary(prompt, gptKey) {
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  }, {
    headers: {
      Authorization: `Bearer ${gptKey}`,
    }
  });

  return response.data.choices[0].message.content;
}

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
