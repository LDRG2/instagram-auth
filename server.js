const express = require('express');
const axios = require('axios');
const app = express();

const port = process.env.PORT || 3000;

const INSTAGRAM_CLIENT_ID = "1305147541755366";
const INSTAGRAM_CLIENT_SECRET = "950fc9715cd1c5dfe230ef0d0332981b";
const REDIRECT_URI = 'https://instagram-auth-r1yc.onrender.com/auth/instagram/callback';

// Step 1: Redirect user to Instagram login
app.get('/auth/instagram', (req, res) => {
  const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=user_profile,user_media&response_type=code`;
  res.redirect(authUrl);
});

// Step 2: Handle the callback
app.get('/auth/instagram/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    return res.send(`Instagram auth error: ${error} - ${req.query.error_reason}`);
  }

  if (!code) {
    return res.send("No code received");
  }

  // Strip any trailing '#_' that Instagram sometimes appends to the code
  const cleanCode = code.replace(/#_$/, '');

  try {
    // --- Short-lived token ---
    const formData = new URLSearchParams({
      client_id: INSTAGRAM_CLIENT_ID,
      client_secret: INSTAGRAM_CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code: cleanCode,
    });

    let shortLivedToken, userId;

    try {
      const shortLivedResponse = await axios.post(
        'https://api.instagram.com/oauth/access_token',
        formData.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000
        }
      );
      shortLivedToken = shortLivedResponse.data.access_token;
      userId = shortLivedResponse.data.user_id;
    } catch (shortErr) {
      const detail = shortErr.response?.data;
      console.error('Short-lived token error:', detail);
      return res.status(500).send(`
        <h2>Failed at short-lived token step</h2>
        <pre>${JSON.stringify(detail, null, 2)}</pre>
        <p>Common causes:</p>
        <ul>
          <li>Code already used (codes are one-time use)</li>
          <li>Redirect URI mismatch in Meta Developer App settings</li>
          <li>App not in correct mode (needs Live mode for other users)</li>
        </ul>
      `);
    }

    // --- Long-lived token ---
    let longLivedToken, expiresIn;

    try {
      const longLivedResponse = await axios.get('https://graph.instagram.com/access_token', {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: INSTAGRAM_CLIENT_SECRET,
          access_token: shortLivedToken,
        },
        timeout: 15000
      });
      longLivedToken = longLivedResponse.data.access_token;
      expiresIn = longLivedResponse.data.expires_in;
    } catch (longErr) {
      const detail = longErr.response?.data;
      console.error('Long-lived token error:', detail);
      return res.status(500).send(`
        <h2>Failed at long-lived token step</h2>
        <pre>${JSON.stringify(detail, null, 2)}</pre>
      `);
    }

    // Success — display token info
    res.send(`
      <h2>✅ Authentication Successful</h2>
      <p><strong>User ID:</strong> ${userId}</p>
      <p><strong>Long-Lived Token:</strong></p>
      <textarea rows="4" cols="80">${longLivedToken}</textarea>
      <p><strong>Expires in:</strong> ${Math.round(expiresIn / 86400)} days</p>
    `);

  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).send(`Unexpected error: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Start auth flow: http://localhost:${port}/auth/instagram`);
});
