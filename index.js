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
  '56958184612', // Francisco Pereira - Jefe Mecánico
];

const JEFE_MECANICO = '56958184612'; // Francisco Pereira

// ── BUFFER TEMPORAL DE IMÁGENES POR OPERADOR ──
const imageBuffer = {};

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
      const mediaId = tipo === 'image' ? message.image.id : message.document.id;

      if (!imageBuffer[phone]) {
        imageBuffer[phone] = [];
      }

      imageBuffer[phone].push(mediaId);
      console.log(`📸 Imagen ${imageBuffer[phone].length} recibida de ${phone}`);

      if (imageBuffer[phone].length === 1) {
        await sendMessage(phone, '✅ Foto 1 recibida. Enviando foto 2...');
        return;
      }

      if (imageBuffer[phone].length >= 2) {
        await sendMessage(phone, '✅ Checklist recibido. Procesando...');

        const mediaId1 = imageBuffer[phone][0];
        const mediaId2 = imageBuffer[phone][1];
        delete imageBuffer[phone];

        const imagen1 = await descargarImagen(mediaId1);
        const imagen2 = await descargarImagen(mediaId2);

        if (imagen1 && imagen2) {
          const analisis = await analizarChecklist(imagen1, imagen2, phone);

          // Notificar a todos los admins
          for (const admin of ADMINS) {
            await sendMessage(admin, `📋 *Checklist recibido*\n📞 Operador: ${phone}\n\n${analisis}`);
          }
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
        await sendMessage(phone, `Para registrar tu inspección, envía las *2 fotos de tu checklist* juntas. 📋`);
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
    const urlRes = await axios.get(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${META_TOKEN}` } }
    );
    const mediaUrl = urlRes.data.url;

    const imgRes = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${META_TOKEN}` },
      responseType: 'arraybuffer'
    });

    const base64 = Buffer.from(imgRes.data).toString('base64');
    console.log(`✅ Imagen descargada`);
    return base64;
  } catch (e) {
    console.error('Error descargando imagen:', e.response?.data || e.message);
    return null;
  }
}

// ── ANÁLISIS DE CHECKLIST CON IA (2 IMÁGENES) ──
async function analizarChecklist(imagen1, imagen2, phone) {
  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imagen1 }
            },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imagen2 }
            },
            {
              type: 'text',
              text: `Eres Pedro, asistente de seguridad de Inggepro. Analiza estas 2 imágenes del checklist de inspección de camión.

INSTRUCCIONES IMPORTANTES:
- Busca las marcas X en la columna CF (Con Falla) — eso es lo que está malo
- Una X en la columna CF indica falla confirmada
- Ignora las columnas B (Bueno) y NA (No Aplica)

CLASIFICACIÓN DE FALLAS (solo reporta los ítems con X en columna CF):

🔴 CRÍTICOS (detener operación inmediatamente):
Luces Delanteras, Mandos de Control, Sistema Eléctrico, Neumático de Repuesto, Estanque de Residuos, Estanque Agua Potable, Coplas Manguera Jet, Freno Carrete, Manguera Jet, Freno de Mano, Pedal, Delantero Derecho, Delantero Izquierdo, Trasero Derecho, Trasero Izquierdo, Aceite Motor, Aceite Hidráulico

🟡 MEDIOS (reparar a la brevedad):
Luces Traseras, Luces Estacionamiento, Portador Tubo Succión

🟢 BAJOS (programar mantención):
Luces Laterales Derecha, Luces Laterales Izquierda, Luces de Cabina

Responde en español con este formato exacto:

🚛 *Análisis Checklist Inggepro*
📞 Operador: ${phone}

📋 *Fallas detectadas (columna CF):*
🔴 Críticas: [lista o "Ninguna"]
🟡 Medias: [lista o "Ninguna"]
🟢 Bajas: [lista o "Ninguna"]

⚠️ *Nivel de riesgo general:* BAJO / MEDIO / ALTO / CRÍTICO

📝 *Recomendación:* [acción inmediata si hay críticos, sino mantenimiento programado]

Si no detectas ninguna X en columna CF responde que el checklist está OK sin fallas.`
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
