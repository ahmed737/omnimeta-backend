const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Meta Webhook Verification Token
const VERIFY_TOKEN = 'omnimeta_secret_token_2026';

// Facebook Page Access Token for page "ASIL"
const PAGE_ACCESS_TOKEN = 'EAATOUhl4sZAcBSZBfFeVxFm7xLRHoVEE1LerXwYQdC9op0BaAEuunTPDzQIwzUoZAmnZAxKPU28P2AL061R4MUSisgvwha7fpDBZANisAZCuFwGgrGuWK6LncqNwJuiMrZAS0xEw5q0CUDZBdZATqh5lP8njzPqBOedEgWwkZCQVEzZBjiPk2G2gx7aGAB2Df3c3q7aPNDO6QZDZD';

const PHONE_NUMBER_ID = '1376320848907133';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';

// تتبع تسلسل رسائل كل عميل في ASIL
const conversationStates = {}; // { [senderId]: { count: 0, botPaused: false } }

app.get('/', (req, res) => {
  res.send('OmniMeta Backend is running live on Vercel! Connected to Page ASIL.');
});

// 1. التحقق من الـ Webhook
app.get(['/webhook', '/api/webhook'], (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2. استقبال الرسائل وتوجيهها للمسار الذكي
app.post(['/webhook', '/api/webhook'], async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'page' || body.object === 'instagram') {
      if (body.entry && body.entry[0] && body.entry[0].messaging) {
        const messaging = body.entry[0].messaging[0];
        const senderId = messaging.sender ? messaging.sender.id : null;
        const message = messaging.message;

        if (senderId && message && !message.is_echo) {
          await handleIncomingMessage('facebook', senderId, message.text || '');
        }
      }
    } 
    else if (body.object === 'whatsapp_business_account') {
      if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from;
        const text = message.text ? message.text.body : '';
        if (from) {
          await handleIncomingMessage('whatsapp', from, text);
        }
      }
    }
  } catch (err) {
    console.error('Error processing webhook:', err.message);
  }

  return res.status(200).send('EVENT_RECEIVED');
});

// 3. مسار ردود ASIL الذكي المتتابع
async function handleIncomingMessage(platform, senderId, text) {
  // إنشاء أو جلب سجل المحادثة مع هذا العميل
  if (!conversationStates[senderId]) {
    conversationStates[senderId] = { count: 0, botPaused: false };
  }

  const userSession = conversationStates[senderId];

  // إذا تم إيقاف البوت يدوياً
  if (userSession.botPaused) {
    console.log(`Agent Handover active for ${senderId}. Skipping bot reply.`);
    return;
  }

  let replyText = null;

  // الرسالة الأولى: الترحيب بالعميل لأول مرة
  if (userSession.count === 0) {
    replyText = `أهلاً بيك في ASIL | أصيل 🖤

سعداء بتواصلك معانا.
إحنا هنا علشان نساعدك تختار الستايل اللي يناسبك.

ابعتلنا استفسارك، وفريقنا هيرد عليك في أقرب وقت.

ASIL — Wear Your Identity.`;
    userSession.count = 1;
  } 
  // الرسالة الثانية: عندما يرد العميل مرة أخرى (طلب صورة المنتج أو الموديل)
  else if (userSession.count === 1) {
    replyText = `نورت ASIL تاني 🖤

علشان نقدر نساعدك بشكل أفضل، ابعتلنا صورة المنتج اللي مهتم بيه، أو صورة الموديل اللي شوفته عندنا.

وهنبعتلك كل التفاصيل المتاحة بخصوص المنتج.

شكرًا لثقتك في ASIL.`;
    userSession.count = 2;
  } 
  // بعد ذلك يتوقف البوت ليتولى الموظفون الرد على صورة المنتج
  else {
    console.log(`User ${senderId} reached human handover stage.`);
    return;
  }

  // إرسال الرد المباشر في ماسنجر
  if (replyText && platform === 'facebook' && PAGE_ACCESS_TOKEN) {
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: senderId },
          message: { text: replyText }
        })
      });
      const result = await response.json();
      console.log('ASIL Messenger reply result:', JSON.stringify(result));
    } catch (fbErr) {
      console.error('Error sending FB reply:', fbErr.message);
    }
  }
}

// 4. Handover API
app.post('/api/handover', (req, res) => {
  const { senderId, pauseBot } = req.body;
  if (!senderId) return res.status(400).send('Missing senderId');
  if (!conversationStates[senderId]) {
    conversationStates[senderId] = { count: 0, botPaused: false };
  }
  conversationStates[senderId].botPaused = !!pauseBot;
  res.json({ success: true, state: conversationStates[senderId] });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
