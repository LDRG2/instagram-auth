const express = require('express');
const app = express();
const port = 3000;

// Route to handle Instagram callback
app.get('/auth/instagram/callback', (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.send("No code received");
  }s
  // For now, just display the code
  res.send(`Received Instagram code: ${code}`);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
