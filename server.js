require('dotenv').config();
const express = require('express');
const path    = require('path');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/estimate', (req, res) => {
  const { requirements, platform } = req.body;
  if (!requirements || !requirements.trim()) {
    return res.status(400).json({ error: 'requirements is required' });
  }
  if (!['web', 'ios', 'android', 'cross', 'api'].includes(platform)) {
    return res.status(400).json({ error: 'invalid platform value' });
  }
  res.status(501).json({ error: 'Not implemented' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Estimatron running on http://localhost:${PORT}`));
}

module.exports = app;
