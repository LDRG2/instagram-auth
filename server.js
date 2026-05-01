const express = require('express');
const app = express();

// Use Render's assigned port or default to 3000 locally
const port = process.env.PORT || 3000;

// Route to handle Instagram callback
app.get('/auth/instagram/callback', (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.send("No code received");
  }
  res.send(`Received Instagram code: ${code}`);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
