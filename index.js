const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const META_TOKEN = process.env.META_TOKEN;
const META_PHONE_ID = process.env.META_PHONE_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const VERIFY_TOKEN = 'fleetcheck2024';

// ── NÚMEROS AUTORIZADOS PARA PEDIR REPORTES ──
const ADMINS = [
  '56963017968', // Sebastián Donetch
  '56XXXXXXXXX', // Francisco Donetch  ← reemplaza con número real
  '56XXXXXXXXX', // Francisco Pereira  ← reemplaza con número real
];

// ── VERIFICACIÓN WEBHOOK META ──
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

// ── WEBHOOK PRINCIPAL ──
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return;

    const phone = message.from;
    const tipo = message.type;
    const text = message.text?.body || '';
    const esAdmin = ADMINS.includes(phone);

    console.log(`Mensaje de ${phone} | Tipo: ${tipo} | Admin: ${esAdmin}`);

    // ── IMAGEN O DOCUMENTO (checklist) ──
    if (tipo === 'image' || tipo === 'document') {
      await sendMessage(phone, '✅ Checklist recibido. Analizando...');
      const analisis = await analizarChecklist(tipo, phone);
      await sendMessage(phone, analisis);
      return;
    }

    // ── MENSAJES DE TEXTO ──
    if (tipo === 'text' && text) {
      const lower = text.toLowerCase();

      // Solo admins pueden pedir reportes
      if (esAdmin) {
        if (lower.includes('reporte') || lower.includes('resumen')) {
          await sendMessage(phone, generarReporteAdmin());
          return;
        }
        if (lower.includes('hola') || lower.includes('pedro')) {
          await sendMessage(phone, `Hola Sebastián 👋\n\nComandos disponibles:\n• *reporte* → Ver quién envió checklist hoy\n• *resumen* → Estado general de la flota`);
          return;
        }
      }

      // Operadores: solo reciben instrucciones
      if (!esAdmin) {
        if (lower.includes('hola') || lower.includes('buenas') || lower.includes('inicio')) {
          await sendMessage(phone, `Hola 👋 Soy Pedro, el asistente de Inggepro.\n\nPor favor envía la *foto de tu checklist* para registrar tu inspección de hoy.`);
        } else {
          await sendMessage(phone, `Para registrar tu inspección, envía la *foto de tu checklist* directamente aquí. 📋`);
        }
        return;
      }
    }

  } catch (e) {
    console.error('Error webhook:', e.message);
  }
});

// ── ANÁLISIS DE CHECKLIST CON IA ──
async function analizarChecklist(tipo, phone) {
  try {
    const prompt = `Eres Pedro, asistente de seguridad de Inggepro. Un operador acaba de enviar su checklist de inspección de camión.

Responde en español de forma clara y breve con este formato exacto:

✅ *Checklist registrado*
📋 *Fallas detectadas:*
- Críticas 🔴: [lista o "Ninguna"]
- Medias 🟡: [lista o "Ninguna"]  
- Menores 🟢: [lista o "Ninguna"]

⚠️ *Nivel de riesgo:* BAJO / MEDIO / ALTO

El operador envió: ${tipo === 'image' ? 'una fotografía del checklist' : 'un documento PDF del checklist'}.
Número: ${phone}`;

    const response = await axios.post('https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
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
    console.error('Error IA:', e.response?.data || e.message);
    return '⚠️ Error al analizar el checklist. Por favor reenvíalo.';
  }
}

// ── REPORTE PARA ADMINS (base para expandir con Google Sheets) ──
function generarReporteAdmin() {
  return `📊 *Reporte FleetCheck Inggepro*\n\n🕐 Esta función estará disponible pronto con Google Sheets integrado.\n\nPor ahora puedes consultar los logs en Railway.`;
}

// ── ENVIAR MENSAJE ──
async function sendMessage(phone, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${META_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${META_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Mensaje enviado a ${phone}`);
  } catch (e) {
    console.error('Error enviando:', e.response?.data || e.message);
  }
}

app.get('/', (req, res) => res.send('Pedro - FleetCheck Bot activo ✅'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Pedro corriendo en puerto ${PORT}`));
