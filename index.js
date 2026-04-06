const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const META_TOKEN = process.env.META_TOKEN;
const META_PHONE_ID = process.env.META_PHONE_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const VERIFY_TOKEN = 'fleetcheck2024';

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;
    const entry = body.entry[0];
    const change = entry.changes[0];
    const message = change.value.messages[0];
    if (!message) return;
    const phone = message.from;
    const text = message.text ? message.text.body : '';
    const tipo = message.type;
    console.log('PHONE:', phone);
    console.log('TEXT:', text);
    if (tipo === 'image' || tipo === 'document') {
      await sendMessage(phone, 'Recibi tu checklist. Analizando...');
      const analisis = await analizarConIA('Operador envio archivo como checklist de camion.');
      await sendMessage(phone, analisis);
      return;
    }
    if (text) {
      const lower = text.toLowerCase();
      if (lower.includes('hola') || lower.includes('checklist') || lower.includes('inicio')) {
        await sendMessage(phone, 'Hola! Soy el bot de FleetCheck Inggepro.\n\nPuedes:\n1. Enviar foto o PDF de tu checklist\n2. Escribir las fallas directamente\n\nComo quieres reportar hoy?');
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
    const response = await axios.post('https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: 'Eres el asistente de FleetCheck para Inggepro. Analiza este reporte de checklist de camion y responde en espanol con: 1. Confirmacion de recepcion 2. Fallas detectadas 3. Si hay fallas CRITICAS indicalo 4. Nivel de riesgo: BAJO/MEDIO/ALTO. Se breve. Reporte: ' + contenido
        }]
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      }
    );
    return response.data.content[0].text;
  } catch (e) {
    console.error('Error IA:', e.response ? e.response.data : e.message);
    return 'Error al analizar. Intenta nuevamente.';
  }
}

async function sendMessage(phone, message) {
  try {
    const url = 'https://graph.facebook.com/v18.0/' + META_PHONE_ID + '/messages';
    await axios.post(url,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          Authorization: 'Bearer ' + META_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Mensaje enviado a:', phone);
  } catch (e) {
    console.error('Error enviando:', e.response ? e.response.data : e.message);
  }
}

app.get('/', (req, res) => res.send('FleetCheck Bot activo'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Bot corriendo en puerto ' + PORT));
