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

// ── REGISTRO DE CHECKLISTS DEL DÍA ──
let registroDelDia = {};
let reporteEnviado = false;
let fechaActual = '';

// ── OPERADORES REGISTRADOS (agregar todos aquí) ──
const OPERADORES = [
  // Ejemplo: '56912345678',
  // Agrega aquí los números de todos los operadores
];

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

// ── VERIFICAR Y RESETEAR DÍA ──
function verificarDia() {
  const hoy = new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });
  if (fechaActual !== hoy) {
    fechaActual = hoy;
    registroDelDia = {};
    reporteEnviado = false;
    console.log(`📅 Nuevo día detectado: ${hoy} - Registro reseteado`);
  }
}

// ── VERIFICAR HORA Y ENVIAR REPORTE 9:30 AM ──
async function verificarReporte930() {
  const ahora = new Date().toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false });
  verificarDia();

  if (ahora >= '09:30' && !reporteEnviado) {
    reporteEnviado = true;
    await enviarReporte930();
  }
}

// ── GENERAR Y ENVIAR REPORTE 9:30 AM ──
async function enviarReporte930() {
  const enviaron = Object.keys(registroDelDia).filter(p => registroDelDia[p].enviado);
  const noEnviaron = OPERADORES.filter(p => !registroDelDia[p]?.enviado);

  const fecha = new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });

  let reporte = `📊 *Reporte Checklist Inggepro*\n📅 ${fecha} | ⏰ 09:30 AM\n\n`;

  reporte += `✅ *Enviaron checklist (${enviaron.length}):*\n`;
  if (enviaron.length > 0) {
    enviaron.forEach(p => {
      const info = registroDelDia[p];
      reporte += `• ${p} | Riesgo: ${info.riesgo || 'Sin datos'}\n`;
    });
  } else {
    reporte += `• Ninguno\n`;
  }

  reporte += `\n❌ *No enviaron checklist (${noEnviaron.length}):*\n`;
  if (noEnviaron.length > 0) {
    noEnviaron.forEach(p => reporte += `• ${p}\n`);
  } else {
    reporte += `• Todos enviaron ✅\n`;
  }

  // Enviar a todos los admins
  for (const admin of ADMINS) {
    await sendMessage(admin, reporte);
  }

  console.log('📊 Reporte 9:30 AM enviado');
}

// ── REVISAR CADA MINUTO ──
setInterval(verificarReporte930, 60000);

// ── WEBHOOK PRINCIPAL ──
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    verificarDia();
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
          const resultado = await analizarChecklist(imagen1, imagen2, phone);

          if (resultado.reenviar) {
            await sendMessage(phone, `⚠️ No pude leer bien tu checklist. Por favor reenvía las fotos siguiendo estas instrucciones:\n\n📸 *Cómo tomar la foto correctamente:*\n1️⃣ Coloca el checklist en una superficie plana\n2️⃣ Toma la foto de frente, sin ángulo\n3️⃣ Asegúrate que haya buena iluminación\n4️⃣ Que se vea la hoja completa y nítida\n5️⃣ No muevas la cámara al sacar la foto\n\nEnvía las 2 fotos nuevamente. 📋`);
            return;
          }

          // Registrar checklist del día
          registroDelDia[phone] = {
            enviado: true,
            hora: new Date().toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' }),
            riesgo: resultado.riesgo,
            tieneCriticos: resultado.tieneCriticos
          };

          // Notificar a todos los admins
          for (const admin of ADMINS) {
            await sendMessage(admin, `📋 *Checklist recibido*\n📞 Operador: ${phone}\n\n${resultado.analisis}`);
          }

          // Si hay críticos alertar inmediatamente a Francisco Pereira
          if (resultado.tieneCriticos) {
            await sendMessage(JEFE_MECANICO, `🚨 *ALERTA CRÍTICA*\n📞 Operador: ${phone}\n⏰ ${registroDelDia[phone].hora}\n\n${resultado.analisis}\n\n⚠️ Se requiere revisión mecánica INMEDIATA.`);
            console.log(`🚨 Alerta crítica enviada a Francisco Pereira por operador ${phone}`);
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
          await enviarReporte930();
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

PASO 1 — VERIFICAR CALIDAD:
Si las fotos están borrosas, muy inclinadas, mal iluminadas o no se ven las columnas responde SOLO con:
REENVIAR

PASO 2 — ANALIZAR (solo si las fotos son legibles):
- Busca las marcas X en la columna CF (Con Falla)
- Ignora columnas B (Bueno) y NA (No Aplica)
- Solo reporta ítems con X en columna CF

CLASIFICACIÓN:
🔴 CRÍTICOS: Luces Delanteras, Mandos de Control, Sistema Eléctrico, Neumático de Repuesto, Estanque de Residuos, Estanque Agua Potable, Coplas Manguera Jet, Freno Carrete, Manguera Jet, Freno de Mano, Pedal, Delantero Derecho, Delantero Izquierdo, Trasero Derecho, Trasero Izquierdo, Aceite Motor, Aceite Hidráulico
🟡 MEDIOS: Luces Traseras, Luces Estacionamiento, Portador Tubo Succión
🟢 BAJOS: Luces Laterales Derecha, Luces Laterales Izquierda, Luces de Cabina

Al final de tu análisis agrega en la última línea SOLO una de estas palabras:
NIVEL:CRITICO (si hay al menos un ítem crítico con X)
NIVEL:MEDIO (si hay ítems medios pero no críticos)
NIVEL:BAJO (si solo hay ítems bajos)
NIVEL:OK (si no hay ninguna X en CF)

Responde con este formato:
🚛 *Análisis Checklist Inggepro*
📞 Operador: ${phone}

📋 *Fallas detectadas (columna CF):*
🔴 Críticas: [lista o "Ninguna"]
🟡 Medias: [lista o "Ninguna"]
🟢 Bajas: [lista o "Ninguna"]

⚠️ *Nivel de riesgo:* BAJO / MEDIO / ALTO / CRÍTICO

📝 *Recomendación:* [acción inmediata si hay críticos]

NIVEL:CRITICO`
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

    const texto = response.data.content[0].text.trim();

    if (texto === 'REENVIAR') {
      return { reenviar: true, analisis: null, riesgo: null, tieneCriticos: false };
    }

    // Extraer nivel de riesgo
    const nivelMatch = texto.match(/NIVEL:(CRITICO|MEDIO|BAJO|OK)/);
    const nivel = nivelMatch ? nivelMatch[1] : 'OK';
    const tieneCriticos = nivel === 'CRITICO';

    // Limpiar el texto eliminando la línea NIVEL:
    const analisisLimpio = texto.replace(/\nNIVEL:(CRITICO|MEDIO|BAJO|OK)/, '').trim();

    return {
      reenviar: false,
      analisis: analisisLimpio,
      riesgo: nivel,
      tieneCriticos
    };

  } catch (e) {
    console.error('Error IA:', e.response?.data || e.message);
    return { reenviar: false, analisis: '⚠️ Error al analizar el checklist.', riesgo: null, tieneCriticos: false };
  }
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
