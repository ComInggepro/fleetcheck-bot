const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const WATI_URL = process.env.WATI_URL;
const WATI_TOKEN = process.env.WATI_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body;
  const phone = msg.waId;
  const text = msg.text || '';
  const tipo = msg.type;

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
});

async function analizarConIA(contenido) {
  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Eres el asistente de FleetCheck para la empresa Inggepro. Analiza este reporte de checklist de camión y responde en español con:
1. ✅ Confirmación de recepción
2. ⚠️ Fallas detectadas (si hay)
3. 🚨 Si hay fallas CRÍTICAS indícalo claramente
4. 📊 Nivel de riesgo: BAJO / MEDIO / ALTO
Sé breve y directo. Reporte: ${contenido}`
      }]
    }, {
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    });
    return response.data.content[0].text;
  } catch (e) {
    console.error('Error IA:', e.message);
    return '❌ Error al analizar el checklist. Intenta nuevamente.';
  }
}

async function sendMessage(phone, message) {
  try {
    const url = `${WATI_URL}/api/v1/sendSessionMessage/${phone}`;
    await axios.post(url, 
      { messageText: message },
      { 
        headers: { 
          Authorization: `Bearer ${WATI_TOKEN}`,
          'Content-Type': 'application/json'
        } 
      }
    );
  } catch (e) {
    console.error('Error enviando mensaje:', e.response?.data || e.message);
  }
}

app.get('/', (req, res) => res.send('FleetCheck Bot activo ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot corriendo en puerto ${PORT}`));
