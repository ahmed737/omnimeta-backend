module.exports = (req, res) => {
  // 1. Meta Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === 'omnimeta_secret_token_2026') {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification failed');
  }

  // 2. Incoming Messages (POST)
  if (req.method === 'POST') {
    console.log('Incoming Meta Webhook:', JSON.stringify(req.body));
    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.status(200).send('OK');
};
