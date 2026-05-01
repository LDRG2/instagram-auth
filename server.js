const express = require('express');
const axios = require('axios');
const app = express();

// Use Render's assigned port or default to 3000 locally
const port = process.env.PORT || 3000;

// Instagram App credentials (replace with your own if they change)
const INSTAGRAM_CLIENT_ID = "1011759921497680";   // Your App ID
const INSTAGRAM_CLIENT_SECRET = "c5479b68a16495aafac0a"; // Your App Secret

// Instagram callback route
app.get('/auth/instagram/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.send("No code received");
  }

  try {
    // Step 1: Exchange code for short-lived access token
    const shortLivedResponse = await axios.post('https://api.instagram.com/oauth/access_token', {
      client_id: INSTAGRAM_CLIENT_ID,
      client_secret: INSTAGRAM_CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: 'https://instagram-auth-r1yc.onrender.com/auth/instagram/callback',
      code: code
    });

    const shortLivedToken = shortLivedResponse.data.access_token;

    // Step 2: Exchange short-lived token for long-lived token
    const longLivedResponse = await axios.get('https://graph.instagram.com/access_token', {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret: INSTAGRAM_CLIENT_SECRET,
        access_token: shortLivedToken
      }
    });

    const longLivedToken = longLivedResponse.data.access_token;

    res.send(`Long-Lived Access Token: ${longLivedToken}`);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error exchanging code for token");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
