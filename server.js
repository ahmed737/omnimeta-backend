const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Meta Webhook Verification Token
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'omnimeta_secret_token_2026';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_CLOUD_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

const conversationStates = {};

// Root Status Check
app.get('/', (req, res) => {
  res.send('OmniMeta Backend is running live on Vercel!');
});

// 1. Meta Webhook Verification (GET /webhook)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2. Incoming Messages Webhook (POST /webhook)
app.post('/webhook', async (req, res) => {
  const body = req.body;
  res.status(200).send('EVENT_RECEIVED');

  if (body.object === 'page' || body.object === 'instagram') {
    body.entry.forEach(async (entry) => {
      const webhookEvent = entry.messaging ? entry.messaging[0] : null;
      if (webhookEvent && webhookEvent.message && webhookEvent.message.text) {
        const senderId = webhookEvent.sender.id;
        await handleIncomingMessage('facebook', senderId, webhookEvent.message.text);
      }
    });
  } else if (body.object === 'whatsapp_business_account') {
    body.entry.forEach(async (entry) => {
      const changes = entry.changes ? entry.changes[0] : null;
      if (changes && changes.value && changes.value.messages && changes.value.messages[0]) {
        const msg = changes.value.messages[0];
        const fromPhone = msg.from;
        const text = msg.text ? msg.text.body : '';
        await handleIncomingMessage('whatsapp', fromPhone, text);
      }
    });
  }
});

// 3. Smart Handover & Auto-Reply Dispatcher
async function handleIncomingMessage(platform, senderId, text) {
  const state = conversationStates[senderId] || { botPaused: false };
  if (state.botPaused) {
    console.log(`Agent Handover active for ${senderId}. Skipping bot reply.`);
    return;
  }

  const lower = (text || '').toLowerCase();
  let replyText = null;

  if (lower.includes('سعر') || lower.includes('بكام') || lower.includes('تكلفة')) {
    replyText = 'أهلاً بك! أسعار باقاتنا تبدأ من 350 جنيه ومتاح الدفع عند الاستلام 💳';
  } else if (lower.includes('شحن') || lower.includes('توصيل')) {
    replyText = 'الشحن متاح لجميع محافظات جمهورية مصر العربية خلال 48 ساعة 🚚';
  } else if (lower.includes('سلام') || lower.includes('مرحبا') || lower.includes('أهلا')) {
    replyText = 'مرحباً بك! يسعدنا تواصلك معنا، كيف يمكننا مساعدتك اليوم؟ 😊';
  }

  if (replyText) {
    if (platform === 'whatsapp' && WHATSAPP_PHONE_ID && WHATSAPP_TOKEN) {
      await axios.post(`https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_ID}/messages`, {
        messaging_product: 'whatsapp',
        to: senderId,
        type: 'text',
        text: { body: replyText }
      }, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }).catch(e => console.log('WA error:', e.message));
    } else if (PAGE_ACCESS_TOKEN) {
      await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
        recipient: { id: senderId },
        message: { text: replyText }
      }).catch(e => console.log('FB error:', e.message));
    }
  }
}

// 4. Handover API
app.post('/api/handover', (req, res) => {
  const { senderId, pauseBot } = req.body;
  if (!senderId) return res.status(400).send('Missing senderId');
  conversationStates[senderId] = { botPaused: !!pauseBot };
  res.json({ success: true, state: conversationStates[senderId] });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

