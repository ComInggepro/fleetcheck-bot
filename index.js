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

// ── OPERADORES REGISTRADOS ──
const OPERADORES = [
  // Agrega aquí los números de todos los operadores
  // Ejemplo: '56912345678',
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
    console.log(`📅 Nuevo día: ${hoy} - Registro reseteado`);
  }
}

// ── VERIFICAR HORA Y DÍA PARA REPORTE ──
async function verificarReporte() {
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const hora = ahora.toTimeString().slice(0, 5);
  const diaSemana = ahora.getDay();

  verificarDia();

  const esDiaReporte = [1, 3, 5].includes(diaSemana);

  if (hora >= '09:00' && hora <= '09:01' && esDiaReporte && !reporteEnviado) {
    reporteEnviado = true;
    await enviarReporte();
  }
}

// ── GENERAR Y ENVIAR REPORTE ──
async function enviarReporte() {
  const enviaron = Object.keys(registroDelDia).filter(p => registroDelDia[p].enviado);
  const noEnviaron = OPERADORES.filter(p => !registroDelDia[p]?.enviado);

  const fecha = new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dia = diasSemana[new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getDay()];

  let reporte = `📊 *Reporte Checklist Inggepro*\n📅 ${dia} ${fecha} | ⏰ 09:00 AM\n\n`;

  reporte += `✅ *Enviaron checklist (${enviaron.length}):*\n`;
  if (enviaron.length > 0) {
    enviaron.forEach(p => {
      const info = registroDelDia[p];
      reporte += `• ${p} | Riesgo: ${info.riesgo || 'Sin datos'} | ⏰ ${info.hora}\n`;
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

  for (const admin of ADMINS) {
    await sendMessage(admin, reporte);
  }

  console.log(`📊 Reporte ${dia} 09:00 AM enviado`);
}

// ── REVISAR CADA MINUTO ──
setInterval(verificarReporte, 60000);

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
        await sendMessage(phone, '⏳ Checklist recibido. Verificando calidad de las fotos...');

        const mediaId1 = imageBuffer[phone][0];
        const mediaId2 = imageBuffer[phone][1];
        delete imageBuffer[phone];

        const imagen1 = await descargarImagen(mediaId1);
        const imagen2 = await descargarImagen(mediaId2);

        if (imagen1 && imagen2) {
          const resultado = await analizarChecklist(imagen1, imagen2, phone);

          if (resultado.reenviar) {
            await sendMessage(phone, 
`❌ *Fotos rechazadas — No se puede leer el checklist*

Por favor vuelve a tomar las fotos siguiendo EXACTAMENTE estas instrucciones:

📋 *Instrucciones obligatorias:*
1️⃣ Coloca el checklist sobre una superficie plana y firme
2️⃣ La hoja debe estar completamente extendida, sin arrugas ni dobleces
3️⃣ Toma la foto desde arriba, perpendicular a la hoja (sin ángulo)
4️⃣ El checklist debe ocupar TODA la foto, sin cortarse ningún borde
5️⃣ Buena iluminación — sin sombras sobre la hoja
6️⃣ La foto debe estar enfocada — todas las letras y columnas deben leerse claramente
7️⃣ No muevas la cámara al sacar la foto

⚠️ *Si la foto no cumple estas condiciones será rechazada nuevamente.*

Envía las 2 fotos nuevamente. 📸`);
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
            await sendMessage(JEFE_MECANICO,
`🚨 *ALERTA CRÍTICA — REVISIÓN INMEDIATA*
📞 Operador: ${phone}
⏰ ${registroDelDia[phone].hora}

${resultado.analisis}

⚠️ Este vehículo requiere revisión mecánica INMEDIATA antes de operar.`);
            console.log(`🚨 Alerta crítica enviada a Francisco Pereira - Operador ${phone}`);
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
          await enviarReporte();
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
              text: `Eres Pedro, inspector de seguridad de Inggepro. Tu trabajo es analizar checklists de inspección de camiones.

═══════════════════════════════
PASO 1 — CONTROL DE CALIDAD ESTRICTO
═══════════════════════════════
Antes de analizar DEBES verificar TODOS estos criterios. Si CUALQUIERA falla, responde SOLO con la palabra: REENVIAR

CRITERIOS OBLIGATORIOS (todos deben cumplirse):
❌ RECHAZAR si la foto está tomada en ángulo (no perpendicular a la hoja)
❌ RECHAZAR si algún borde del checklist está cortado o fuera de la foto
❌ RECHAZAR si hay sombras que tapan alguna columna o fila
❌ RECHAZAR si el texto o las columnas no se leen con claridad
❌ RECHAZAR si la imagen está movida o desenfocada
❌ RECHAZAR si la hoja está arrugada o doblada y dificulta la lectura
❌ RECHAZAR si no se distingue claramente la columna CF de las demás
❌ RECHAZAR si la iluminación es insuficiente o hay zonas muy oscuras
❌ RECHAZAR si no es claramente un checklist de inspección de Inggepro

Sé EXTREMADAMENTE estricto. Si tienes cualquier duda sobre la calidad, responde REENVIAR.

═══════════════════════════════
PASO 2 — ANÁLISIS (solo si TODAS las condiciones se cumplen)
═══════════════════════════════
- Busca ÚNICAMENTE las marcas X en la columna CF (Con Falla)
- Ignora completamente las columnas B (Bueno) y NA (No Aplica)
- Solo reporta ítems que tengan X marcada en la columna CF

CLASIFICACIÓN DE FALLAS:
🔴 CRÍTICOS: Luces Delanteras, Mandos de Control, Sistema Eléctrico, Neumático de Repuesto, Estanque de Residuos, Estanque Agua Potable, Coplas Manguera Jet, Freno Carrete, Manguera Jet, Freno de Mano, Pedal, Delantero Derecho, Delantero Izquierdo, Trasero Derecho, Trasero Izquierdo, Aceite Motor, Aceite Hidráulico
🟡 MEDIOS: Luces Traseras, Luces Estacionamiento, Portador Tubo Succión
🟢 BAJOS: Luces Laterales Derecha, Luces Laterales Izquierda, Luces de Cabina

Al final agrega en la última línea SOLO una de estas palabras:
NIVEL:CRITICO — si hay al menos un ítem crítico con X
NIVEL:MEDIO — si hay ítems medios pero no críticos
NIVEL:BAJO — si solo hay ítems bajos
NIVEL:OK — si no hay ninguna X en columna CF

FORMATO DE RESPUESTA:
🚛 *Análisis Checklist Inggepro*
📞 Operador: ${phone}

📋 *Fallas detectadas (columna CF):*
🔴 Críticas: [lista detallada o "Ninguna"]
🟡 Medias: [lista detallada o "Ninguna"]
🟢 Bajas: [lista detallada o "Ninguna"]

⚠️ *Nivel de riesgo:* BAJO / MEDIO / ALTO / CRÍTICO

📝 *Recomendación:* [acción concreta y específica]

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

    const nivelMatch = texto.match(/NIVEL:(CRITICO|MEDIO|BAJO|OK)/);
    const nivel = nivelMatch ? nivelMatch[1] : 'OK';
    const tieneCriticos = nivel === 'CRITICO';
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
