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

const conversationStates = {};

app.get('/', (req, res) => {
  res.send('OmniMeta Backend is running live on Vercel! Connected to Page ASIL.');
});

// 1. Meta Webhook Verification
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

// 2. Incoming Messages Webhook (Fixed: Awaits message sending before closing)
app.post(['/webhook', '/api/webhook'], async (req, res) => {
  try {
    const body = req.body;

    // Handle Facebook Messenger & Instagram Messages
    if (body.object === 'page' || body.object === 'instagram') {
      if (body.entry && body.entry[0] && body.entry[0].messaging) {
        const messaging = body.entry[0].messaging[0];
        const senderId = messaging.sender ? messaging.sender.id : null;
        const message = messaging.message;

        if (senderId && message && message.text && !message.is_echo) {
          console.log(`Received message: ${message.text} from ${senderId}`);
          await handleIncomingMessage('facebook', senderId, message.text);
        }
      }
    } 
    // Handle WhatsApp Messages
    else if (body.object === 'whatsapp_business_account') {
      if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from;
        const text = message.text ? message.text.body : '';
        if (from && text) {
          await handleIncomingMessage('whatsapp', from, text);
        }
      }
    }
  } catch (err) {
    console.error('Error processing webhook:', err.message);
  }

  // إغلاق الطلب بعد إتمام الإرسال لمنع تجمد Vercel
  return res.status(200).send('EVENT_RECEIVED');
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

  if (lower.includes('سعر') || lower.includes('بكام') || lower.includes('تكلفة') || lower.includes('كام')) {
    replyText = 'أهلاً بك يا فندم في صفحة ASIL! أسعار باقاتنا تبدأ من 350 جنيه مع خصم خاص ومتاح الدفع عند الاستلام 💳';
  } else if (lower.includes('شحن') || lower.includes('توصيل') || lower.includes('ميعاد')) {
    replyText = 'الشحن متاح لجميع محافظات جمهورية مصر العربية خلال 48 ساعة فقط والدفع عند الاستلام 🚚';
  } else if (lower.includes('سلام') || lower.includes('مرحبا') || lower.includes('أهلا') || lower.includes('مساء') || lower.includes('صباح')) {
    replyText = 'مرحباً بك في صفحة ASIL! يسعدنا تواصلك معنا، كيف يمكننا مساعدتك اليوم؟ 😊';
  } else {
    replyText = 'أهلاً بك في صفحة ASIL! تم استلام رسالتك وسيتواصل معك أحد ممثلي خدمة العملاء فوراً.';
  }

  if (replyText) {
    if (platform === 'facebook' && PAGE_ACCESS_TOKEN) {
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
        console.log('FB Messenger reply result:', JSON.stringify(result));
      } catch (fbErr) {
        console.error('Error sending FB reply:', fbErr.message);
      }
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
