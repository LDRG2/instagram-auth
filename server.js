const express = require('express');
const axios = require('axios');
const app = express();

const port = process.env.PORT || 3000;

// Inserted values (as requested)
const INSTAGRAM_CLIENT_ID = "1305147541755366";
const INSTAGRAM_CLIENT_SECRET = "950fc9715cd1c5dfe230ef0d0332981b";

app.get('/auth/instagram/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.send("No code received");
  }

  try {
    const params = new URLSearchParams();
    params.append('client_id', INSTAGRAM_CLIENT_ID);
    params.append('client_secret', INSTAGRAM_CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', 'https://instagram-auth-r1yc.onrender.com/auth/instagram/callback');
    params.append('code', code);

    const shortLivedResponse = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );

    const shortLivedToken = shortLivedResponse.data.access_token;

    const longLivedResponse = await axios.get('https://graph.instagram.com/access_token', {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret: INSTAGRAM_CLIENT_SECRET,
        access_token: shortLivedToken
      },
      timeout: 15000
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
