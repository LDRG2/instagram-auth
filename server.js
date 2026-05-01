const express = require('express');
const axios = require('axios');
const app = express();

const port = process.env.PORT || 3000;

const INSTAGRAM_CLIENT_ID = "1305147541755366";
const INSTAGRAM_CLIENT_SECRET = "950fc9715cd1c5dfe230ef0d0332981b";
const REDIRECT_URI = 'https://instagram-auth-r1yc.onrender.com/auth/instagram/callback';

// Step 1: Redirect user to Instagram login
app.get('/auth/instagram', (req, res) => {
  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=instagram_basic,pages_show_list&response_type=code`;
  res.redirect(authUrl);
});

// Step 2: Handle the callback
app.get('/auth/instagram/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    return res.send(`
      <h2>❌ Instagram Auth Error</h2>
      <p><strong>Error:</strong> ${error}</p>
      <p><strong>Reason:</strong> ${req.query.error_reason}</p>
      <p><strong>Description:</strong> ${req.query.error_description}</p>
      <a href="/auth/instagram">Try Again</a>
    `);
  }

  if (!code) {
    return res.send(`
      <h2>❌ No Code Received</h2>
      <p>Instagram did not return an authorization code.</p>
      <a href="/auth/instagram">Try Again</a>
    `);
  }

  // Strip any trailing '#_' Instagram sometimes appends
  const cleanCode = code.replace(/#_$/, '');

  try {
    // --- Step A: Get Short-Lived Token via new Facebook Graph API ---
    let shortLivedToken, userId;

    try {
      const shortLivedResponse = await axios.post(
        'https://graph.facebook.com/v19.0/oauth/access_token',
        null,
        {
          params: {
            client_id: INSTAGRAM_CLIENT_ID,
            client_secret: INSTAGRAM_CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            code: cleanCode,
          },
          timeout: 15000
        }
      );
      shortLivedToken = shortLivedResponse.data.access_token;
      userId = shortLivedResponse.data.user_id;
    } catch (shortErr) {
      const detail = shortErr.response?.data;
      console.error('Short-lived token error:', detail);
      return res.status(500).send(`
        <h2>❌ Failed at Short-Lived Token Step</h2>
        <pre style="background:#f4f4f4;padding:16px;border-radius:8px">${JSON.stringify(detail, null, 2)}</pre>
        <h3>Common Fixes:</h3>
        <ul>
          <li>Make sure your Meta App type is set to <strong>Business</strong></li>
          <li>Make sure you added <strong>Instagram</strong> as a product (not Basic Display API)</li>
          <li>Redirect URI in Meta Dashboard must be exactly: <code>${REDIRECT_URI}</code></li>
          <li>App must be in <strong>Live mode</strong> for non-developer users</li>
          <li>Do not refresh this page — codes are one-time use. <a href="/auth/instagram">Start over</a></li>
        </ul>
      `);
    }

    // --- Step B: Exchange for Long-Lived Token ---
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
        <h2>❌ Failed at Long-Lived Token Step</h2>
        <pre style="background:#f4f4f4;padding:16px;border-radius:8px">${JSON.stringify(detail, null, 2)}</pre>
        <p>Short-lived token was obtained successfully, but exchange to long-lived failed.</p>
        <a href="/auth/instagram">Try Again</a>
      `);
    }

    // --- Step C: Fetch Instagram Business Account ID ---
    let igAccountId = 'N/A';

    try {
      // Get connected Facebook Pages
      const pagesResponse = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
        params: { access_token: longLivedToken },
        timeout: 15000
      });

      const pages = pagesResponse.data.data;
      if (pages && pages.length > 0) {
        const pageToken = pages[0].access_token;
        const pageId = pages[0].id;

        // Get Instagram Business Account linked to the page
        const igResponse = await axios.get(`https://graph.facebook.com/v19.0/${pageId}`, {
          params: {
            fields: 'instagram_business_account',
            access_token: pageToken
          },
          timeout: 15000
        });

        igAccountId = igResponse.data.instagram_business_account?.id || 'No IG account linked to page';
      }
    } catch (igErr) {
      console.error('Instagram account fetch error:', igErr.response?.data || igErr.message);
      igAccountId = 'Could not fetch (non-critical)';
    }

    // --- Success ---
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Instagram Auth Success</title>
        <style>
          body { font-family: sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; }
          textarea { width: 100%; padding: 10px; font-family: monospace; font-size: 13px; }
          .card { background: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 16px 0; }
          .success { color: #2e7d32; }
          button { padding: 8px 16px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2 class="success">✅ Authentication Successful</h2>

        <div class="card">
          <p><strong>Facebook User ID:</strong> ${userId || 'N/A'}</p>
          <p><strong>Instagram Business Account ID:</strong> ${igAccountId}</p>
          <p><strong>Token expires in:</strong> ${expiresIn ? Math.round(expiresIn / 86400) + ' days' : 'N/A'}</p>
        </div>

        <div class="card">
          <p><strong>Long-Lived Access Token:</strong></p>
          <textarea id="token" rows="4">${longLivedToken}</textarea>
          <br/><br/>
          <button onclick="navigator.clipboard.writeText(document.getElementById('token').value)">
            📋 Copy Token
          </button>
        </div>

        <p style="color:#888;font-size:13px">⚠️ Keep this token private. Do not share it publicly.</p>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).send(`
      <h2>❌ Unexpected Error</h2>
      <p>${error.message}</p>
      <a href="/auth/instagram">Try Again</a>
    `);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Start auth at: http://localhost:${port}/auth/instagram`);
});
