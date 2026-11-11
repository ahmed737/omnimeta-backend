const axios = require('axios');

// معرّف رقم واتساب الخاص بك
const PHONE_NUMBER_ID = '1376320848907133';

// الصق الرمز الذي نسخته هنا بين علامتي التنصيص
const ACCESS_TOKEN = 'EAATOUhl4sZAcBS9nYBjSZBUtTGBd60jqZAlhFG7ICCBRKdAQ5zVNzpBA1y6MfO0jE7evvaO5qtofNf7AIT0OioaGkyWBUM6knBR7fd3ir8vymZAiYUFZAZBIgxOxoxT7wTAJorATdc2hPVmnPCUyZAO4ZBPEZArUmKZAz2LVC0tBV9CJi08mJivxVs6zZArHua1QQZDZD';

module.exports = async (req, res) => {
  // 1. التحقق من الـ Webhook
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

  // 2. استقبال الرسالة والرد الآلي عليها في واتساب
  if (req.method === 'POST') {
    try {
      const body = req.body;
      if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from; // رقم العميل
        const text = (message.text ? message.text.body : '').toLowerCase();

        let replyText = null;
        if (text.includes('سعر') || text.includes('بكام') || text.includes('تكلفة')) {
          replyText = 'أهلاً بك يا فندم! أسعار باقاتنا تبدأ من 350 جنيه مع خصم خاص ومتاح الدفع عند الاستلام 💳';
        } else if (text.includes('شحن') || text.includes('توصيل')) {
          replyText = 'الشحن متاح لجميع محافظات جمهورية مصر العربية خلال 48 ساعة فقط 🚚';
        } else {
          replyText = 'مرحباً بك! يسعدنا تواصلك مع صفحتنا، كيف يمكننا مساعدتك اليوم؟ 😊';
        }

        // إرسال الرد المباشر إلى رقم العميل عبر WhatsApp Cloud API
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

    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.status(200).send('OK');
};
