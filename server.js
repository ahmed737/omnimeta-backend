const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const VERIFY_TOKEN = 'omnimeta_secret_token_2026';
const PHONE_NUMBER_ID = '1376320848907133';

// الصق رمز الوصول (Token) الخاص بك هنا بين علامتي التنصيص
const ACCESS_TOKEN = 'EAATOUhl4sZAcBSw4JHZCeoj74fZAlsGD3cLLlZAJ1sTjgQCZB90Truby0T2tzvRtgoQUianmhzrZBU2zEdlw5Cea6lrXjlggMcndEQVOTihvzjPQ9qcCYEr8PfJBZArhgPs1i3OHBc1RUtjIR3obe7WKzobNLU9n3JZCUGZCDAVlq6d9KTRWE0mJfdmZAJ7xtCwgZDZD';

// مسار الصفحة الرئيسية
app.get('/', (req, res) => {
  res.send('OmniMeta Backend is running live on Vercel!');
});

// 1. التحقق من الويب هوك (يدعم كلا الرابطين)
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

// 2. استقبال الرسائل والرد الآلي عليها فوراً
app.post(['/webhook', '/api/webhook'], async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const text = (message.text ? message.text.body : '').toLowerCase();

      let replyText = null;
      if (text.includes('سعر') || text.includes('بكام') || text.includes('تكلفة')) {
        replyText = 'أهلاً بك يا فندم! أسعار باقاتنا تبدأ من 350 جنيه مع خصم خاص ومتاح الدفع عند الاستلام 💳';
      } else if (text.includes('شحن') || text.includes('توصيل')) {
        replyText = 'الشحن متاح لجميع محافظات جمهورية مصر العربية خلال 48 ساعة فقط 🚚';
      } else {
        replyText = 'مرحباً بك! تم استلام رسالتك عبر البوت الذكي، وسنتواصل معك فوراً 😊';
      }

      if (replyText) {
        await axios.post(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
          messaging_product: 'whatsapp',
          to: from,
          type: 'text',
          text: { body: replyText }
        }, {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
      }
    }
  } catch (err) {
    console.error('Error sending reply:', err.message);
  }
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
