const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const META_TOKEN = process.env.META_TOKEN;
const META_PHONE_ID = process.env.META_PHONE_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const VERIFY_TOKEN = 'fleetcheck2024';

// ── NÚMEROS AUTORIZADOS ──
const ADMINS = [
  '56979798880', // Sebastián Donetch
  '56976092114', // Francisco Donetch
  '56958184612', // Francisco Pereira
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
      // Confirmación simple al operador
      await sendMessage(phone, '✅ Checklist recibido.');

      // Obtener la imagen de Meta
      const mediaId = tipo === 'image' ? message.image.id : message.document.id;
      const imageBase64 = await descargarImagen(mediaId);

      // Analizar con IA y notificar a admins
      if (imageBase64) {
        const analisis = await analizarChecklist(imageBase64, phone);
        for (const admin of ADMINS) {
          await sendMessage(admin, `📋 *Checklist recibido*\n📞 Operador: ${phone}\n\n${analisis}`);
        }
      }
      return;
    }

    // ── MENSAJES DE TEXTO ──
    if (tipo === 'text' && text) {
      const lower = text.toLowerCase();

      if (esAdmin) {
        if (lower.includes('reporte') || lower.includes('resumen')) {
          await sendMessage(phone, generarReporteAdmin());
          return;
        }
        if (lower.includes('hola') || lower.includes('pedro')) {
          await sendMessage(phone, `Hola 👋\n\nComandos disponibles:\n• *reporte* → Ver quién envió checklist hoy\n• *resumen* → Estado general de la flota`);
          return;
        }
      }

      if (!esAdmin) {
        await sendMessage(phone, `Para registrar tu inspección, envía la *foto de tu checklist* directamente aquí. 📋`);
        return;
      }
    }

  } catch (e) {
    console.error('Error webhook:', e.message);
  }
});

// ── DESCARGAR IMAGEN DESDE META ──
async function descargarImagen(mediaId) {
  try {
    // Obtener URL de la imagen
    const urlRes = await axios.get(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${META_TOKEN}` } }
    );
    const mediaUrl = urlRes.data.url;

    // Descargar imagen como base64
    const imgRes = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${META_TOKEN}` },
      responseType: 'arraybuffer'
    });

    const base64 = Buffer.from(imgRes.data).toString('base64');
    console.log('✅ Imagen descargada correctamente');
    return base64;
  } catch (e) {
    console.error('Error descargando imagen:', e.response?.data || e.message);
    return null;
  }
}

// ── ANÁLISIS DE CHECKLIST CON IA (VISIÓN) ──
async function analizarChecklist(imageBase64, phone) {
  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: `Eres Pedro, asistente de seguridad de Inggepro. Analiza este checklist de inspección de camión y responde en español con este formato exacto:

🚛 *Análisis de Checklist*

✅ *Ítems en buen estado:* [lista breve]

📋 *Fallas detectadas:*
- Críticas 🔴: [lista o "Ninguna"]
- Medias 🟡: [lista o "Ninguna"]
- Menores 🟢: [lista o "Ninguna"]

⚠️ *Nivel de riesgo:* BAJO / MEDIO / ALTO

📝 *Observaciones:* [observaciones relevantes del checklist]`
            }
          ]
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
    console.error('Error IA:', e.response?.data || e.message);
    return '⚠️ Error al analizar el checklist.';
  }
}

// ── REPORTE PARA ADMINS ──
function generarReporteAdmin() {
  return `📊 *Reporte FleetCheck Inggepro*\n\n🕐 Función de reporte completo próximamente con Google Sheets integrado.`;
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
