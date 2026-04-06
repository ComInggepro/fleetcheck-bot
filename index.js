const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const WATI_URL = (process.env.WATI_URL || '').replace(/\/$/, '');
const WATI_TOKEN = process.env.WATI_TOKEN;
const GEMINI_KEY = process.env.GEMINI_KEY;

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const msg = req.body;
    console.log('BODY:', JSON.stringify(msg));
    const phone = msg.waId || msg.from || (msg.conversation && msg.conversation.id);
    const text = msg.text || msg.body || '';
    const tipo = msg.type;
    console.log('PHONE:', phone);
    console.log('TEXT:', text);

    if (!phone) return;

    if (tipo === 'image' || tipo === 'document') {
      await sendMessage(phone, '📋 Recibí tu checklist. Analizando con IA...');
      const analisis = await analizarConIA('El operador envió un archivo adjunto como checklist de camión.');
      await sendMessage(phone, analisis);
      return;
    }

    if (text) {
      const lower = text.toLowerCase();
      if (lower.includes('hola') || lower.includes('checklist') || lower.includes('inicio')) {
        await sendMessage(phone, '✅ Hola! Soy el bot de FleetCheck Inggepro.\n\nPuedes:\n1️⃣ Enviar una foto o PDF de tu checklist\n2️⃣ Escribir las fallas directamente\n\n¿Cómo quieres reportar hoy?');
      } else {
        const analisis = await analizarConIA(text);
        await sendMessage(phone, analisis);
      }
    }
  } catch(e) {
    console.error('Error webhook:', e.message);
  }
});

async function analizarConIA(contenido) {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{
          parts: [{
            text: `Eres el asistente de FleetCheck para la empresa Inggepro. Analiza este reporte de checklist de camión y responde en español con:
1. ✅ Confirmación de recepción
2. ⚠️ Fallas detectadas (si hay)
3. 🚨 Si hay fallas CRÍTICAS indícalo claramente
4. 📊 Nivel de riesgo: BAJO / MEDIO / ALTO
Sé breve y directo. Reporte: ${contenido}`
          }]
        }]
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data.candidates[0].content.parts[0].text;
  } catch (e) {
    console.error('Error IA:', e.response?.data || e.message);
    return '❌ Error al analizar el checklist. Intenta nuevamente.';
  }
}

async function sendMessage(phone, message) {
  try {
    const url = `${WATI_URL}/api/v1/sendSessionMessage/${phone}`;
    console.log('Enviando a:', url);
    const response = await axios.post(url,
      { messageText: message },
      {
        headers: {
          Authorization: WATI_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Respuesta Wati:', response.status);
  } catch (e) {
    console.error('Error enviando:', e.response?.data || e.message);
  }
}

app.get('/', (req, res) => res.send('FleetCheck Bot activo ✅'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot corriendo en puerto ${PORT}`));
