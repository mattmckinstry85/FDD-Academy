const https = require('https');

function callAnthropic(body) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', (err) => resolve(JSON.stringify({ error: err.message })));
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const body = JSON.stringify(req.body);
  const maxRetries = 3;
  const delays = [1000, 2000, 4000];

  for (let i = 0; i < maxRetries; i++) {
    const data = await callAnthropic(body);
    let parsed;
    try { parsed = JSON.parse(data); } catch(e) { parsed = {}; }
    if (parsed.type === 'error' && parsed.error && parsed.error.type === 'overloaded_error') {
      if (i < maxRetries - 1) { await sleep(delays[i]); continue; }
    }
    return res.status(200).json(parsed);
  }
  return res.status(200).json({ type: 'error', error: { message: 'API busy - try again.' }});
};
