const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const META_TOKEN = process.env.META_TOKEN;
const META_PHONE_ID = process.env.META_PHONE_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const VERIFY_TOKEN = 'fleetcheck2024';

// ── ROLES Y CONTACTOS ──
const SEBASTIAN = '56979798880';
const FRANCISCO_DONETCH = '56976092114';
const FRANCISCO_PEREIRA = '56958184612';
const FRANCO_BUSTOS = '56966882256';

const ADMINS = [SEBASTIAN, FRANCISCO_DONETCH];
const AUTORIZADOS = [SEBASTIAN, FRANCISCO_DONETCH, FRANCISCO_PEREIRA, FRANCO_BUSTOS];

// ── OPERADORES ACTIVOS ──
const OPERADORES = [
  { nombre: 'ALBORNOZ BARRIOS DANIEL ESTEBAN',    phone: '56975300153', tipo: 'Furgon',  patente: 'LFSK94',  licencia: '26-11-2030' },
  { nombre: 'ALBORNOZ VERGARA HECTOR DANIEL',     phone: '56936116886', tipo: 'Camion',  patente: 'RKXL89',  licencia: '21-02-2027' },
  { nombre: 'ALEX ANTONIO ZAMBRANO MONSALVE',     phone: '56946658377', tipo: 'Camion',  patente: '',        licencia: '06-04-2028' },
  { nombre: 'ALVAREZ PEREZ MANUEL ALEJANDRO',     phone: '56942800772', tipo: 'Camion',  patente: 'LKVS93',  licencia: '06-04-2028' },
  { nombre: 'ARANCIBIA PINO RUBEN MARCOS',        phone: '56990840526', tipo: 'Furgon',  patente: 'LLXD60',  licencia: '22-10-2027' },
  { nombre: 'BARAHONA GALAZ IGNACIO ANTONIO',     phone: '56972694364', tipo: 'Camion',  patente: 'PKLY73',  licencia: '04-10-2028' },
  { nombre: 'BASCUÑAN BAEZA JONATHAN ALEXIS',     phone: '56961838994', tipo: 'Camion',  patente: 'TLDB81',  licencia: '24-11-2028' },
  { nombre: 'OPERADOR SIN NOMBRE',                phone: '56995392613', tipo: 'Furgon',  patente: 'KJKR55',  licencia: null },
  { nombre: 'CAMPOS VIDAL HECTOR MANUEL',         phone: '56942906347', tipo: 'Camion',  patente: 'HBHB77',  licencia: '20-03-2031' },
  { nombre: 'CARRASCO SALAZAR JONATHAN PATRICIO', phone: '56957880263', tipo: 'Furgon',  patente: 'SCKZ25',  licencia: '06-04-2032' },
  { nombre: 'COLIMA LUENGO NELSON EDUARDO',       phone: '56963092755', tipo: 'Camion',  patente: 'LGLV88',  licencia: '22-10-2027' },
  { nombre: 'FARA HIDALGO GINO EDUARDO',          phone: '56966980414', tipo: 'Furgon',  patente: 'KVWL90',  licencia: '29-11-2027' },
  { nombre: 'FLORES VALENZUELA ERIC ALBERTO',     phone: '56963947489', tipo: 'Camion',  patente: 'LGLV88',  licencia: '19-12-2025' },
  { nombre: 'FRANCISCO PEREIRA',                  phone: '56958184612', tipo: 'Furgon',  patente: 'SSZV-73', licencia: 'RECUPERACION' },
  { nombre: 'GONZALEZ SOTO JOSE CARLOS',          phone: '56926856293', tipo: 'Camion',  patente: 'LJTT46',  licencia: '04-12-2027' },
  { nombre: 'LANDAETA ALVAREZ JESUS FERNANDO',    phone: '56948811117', tipo: 'Camion',  patente: 'PCSX67',  licencia: '07-07-2029' },
  { nombre: 'MENDEZ SALAS JAVIER JOSE',           phone: '56940637526', tipo: 'Furgon',  patente: 'LFSK89',  licencia: '13-08-2029' },
  { nombre: 'MILLACARIS RIVEROS RICARDO ANTONIO', phone: '56994027623', tipo: 'Camion',  patente: 'LJTT45',  licencia: '10-09-2026' },
  { nombre: 'MOLINA MUÑOZ ROBINSON JERMAN',       phone: '56964081753', tipo: 'Camion',  patente: 'HVCJ45',  licencia: '14-07-2026' },
  { nombre: 'MONTERO BRAVO MAXIMILIANO ANDRES',   phone: '56940980441', tipo: 'Camion',  patente: 'TFHP23',  licencia: '19-03-2028' },
  { nombre: 'MUÑOZ MUÑOZ JOSE ALEJANDRO',         phone: '56942192825', tipo: 'Camion',  patente: 'HBKC83',  licencia: '22-03-2030' },
  { nombre: 'MUÑOZ POBLETE LUIS GABRIEL',         phone: '56944298028', tipo: 'Camion',  patente: 'LGLT76',  licencia: '22-12-2029' },
  { nombre: 'MUÑOZ SEPULVEDA SEBASTIAN RODRIGO',  phone: '56956281733', tipo: 'Camion',  patente: 'LGJX10',  licencia: '05-04-2030' },
  { nombre: 'MUÑOZ TORRES JAIME PATRICIO',        phone: '56975597074', tipo: 'Furgon',  patente: 'LFSK92',  licencia: '20-03-2031' },
  { nombre: 'NUÑEZ ABURTO RICHARD CAMILO',        phone: '56934920216', tipo: 'Furgon',  patente: 'LXXX27',  licencia: '22-11-2032' },
  { nombre: 'PANTALEON GUERRERO JHON PAUL',       phone: '56978305143', tipo: 'Camion',  patente: 'LGJX10',  licencia: '05-03-2028' },
  { nombre: 'PINTO ULLOA JUAN CARLOS',            phone: '56973900730', tipo: 'Camion',  patente: 'HLYX10',  licencia: '06-06-2028' },
  { nombre: 'REYES MIRANDA WLADIMIR ANDRES',      phone: '56952290819', tipo: 'Camion',  patente: 'TGPD40',  licencia: '12-11-2026' },
  { nombre: 'ROCO VERDUGO DANILO FIDEL',          phone: '56957334347', tipo: 'Camion',  patente: 'LGLT77',  licencia: '02-09-2028' },
  { nombre: 'ROMERO RIVERA EDGARD ALEXIS',        phone: '56958709665', tipo: 'Furgon',  patente: 'SCKZ39',  licencia: '18-02-2030' },
  { nombre: 'TOLOSA CEBALLOS NICOLAS FRANCISCO',  phone: '56988189421', tipo: 'Furgon',  patente: 'LGGH52',  licencia: '29-10-2027' },
  { nombre: 'ULLOA PARADA CLAUDIO MAURICIO',      phone: '56945800760', tipo: 'Furgon',  patente: 'LFSK91',  licencia: '18-06-2027' },
  { nombre: 'VEGA TORRES ROBERTO IGNACIO',        phone: '56950525363', tipo: 'Furgon',  patente: 'DXST21',  licencia: '22-03-2030' },
  { nombre: 'VEJAR QUEZADA DOMINGO ANTONIO',      phone: '56927077477', tipo: 'Camion',  patente: 'PFYS58',  licencia: '06-11-2027' },
  { nombre: 'VERA CARVAJAL JESUS MATIAS',         phone: '56983616095', tipo: 'Camion',  patente: 'SGSL85',  licencia: '07-07-2026' },
  { nombre: 'YAÑEZ HIDALGO JORGE EDUARD',         phone: '56963390750', tipo: 'Camion',  patente: 'KZXG15',  licencia: '07-12-2026' },
  { nombre: 'GALARCE GUTIERREZ NICOLAS IGNACIO',  phone: '56951741762', tipo: 'Furgon',  patente: 'LFSK59',  licencia: '22-06-2029' },
];

// ── REGISTRO DEL DÍA ──
let registroDelDia = {};
let reporteEnviado = false;
let alertaLicenciasEnviada = false;
let fechaActual = '';

// ── BUFFER TEMPORAL DE IMÁGENES ──
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
    alertaLicenciasEnviada = false;
    console.log(`📅 Nuevo día: ${hoy} - Registro reseteado`);
  }
}

// ── PARSEAR FECHA ──
function parsearFecha(fechaStr) {
  if (!fechaStr || fechaStr === 'RECUPERACION') return null;
  const partes = fechaStr.split('-');
  if (partes.length !== 3) return null;
  return new Date(`${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`);
}

// ── MENÚ OPERADOR ──
const MENU_OPERADOR =
`👷 *Bienvenido a Inggepro*
Buenos días, te deseamos un gran día y que tengas un excelente turno. 🚛

Para registrar tu inspección del día envía las *2 fotos de tu checklist* directamente aquí. 📋`;

// ── MENÚ ADMIN/JEFES ──
const MENU_ADMIN =
`👋 *Hola, soy Pedro — Asistente Inggepro*

¿Qué necesitas?

1️⃣ *Resumen Flota* → Informe general por patente y fallas
2️⃣ *Licencias / Rev Técnicas* → Estado de documentos
3️⃣ *Checklist del día* → Quién envió y quién no

Responde con *1*, *2* o *3*.`;

// ── RESUMEN FLOTA ──
async function generarResumenFlota(phone) {
  const fecha = new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });
  let resumen = `🚛 *Resumen de Flota Inggepro*\n📅 ${fecha}\n\n`;

  const conChecklist = OPERADORES.filter(op => registroDelDia[op.phone]?.enviado);
  const sinChecklist = OPERADORES.filter(op => !registroDelDia[op.phone]?.enviado);

  if (conChecklist.length > 0) {
    resumen += `✅ *Vehículos con checklist hoy:*\n`;
    conChecklist.forEach(op => {
      const info = registroDelDia[op.phone];
      resumen += `\n🔹 *${op.patente}* — ${op.tipo}\n`;
      resumen += `   👤 ${op.nombre}\n`;
      resumen += `   ⏰ ${info.hora} | Riesgo: ${info.riesgo}\n`;
      if (info.tieneCriticos) resumen += `   🚨 TIENE FALLAS CRÍTICAS\n`;
    });
    resumen += '\n';
  }

  if (sinChecklist.length > 0) {
    resumen += `❌ *Sin checklist hoy (${sinChecklist.length}):*\n`;
    sinChecklist.forEach(op => {
      resumen += `• ${op.patente} — ${op.nombre}\n`;
    });
  }

  await sendMessage(phone, resumen);
}

// ── VERIFICAR LICENCIAS ──
async function verificarLicencias(phone = null) {
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const en30dias = new Date(hoy);
  en30dias.setDate(en30dias.getDate() + 30);

  const vencidas = [];
  const proximas = [];
  const recuperacion = [];

  for (const op of OPERADORES) {
    if (op.licencia === 'RECUPERACION') { recuperacion.push(op); continue; }
    const fecha = parsearFecha(op.licencia);
    if (!fecha) continue;
    if (fecha < hoy) {
      vencidas.push({ ...op });
    } else if (fecha <= en30dias) {
      const diasRestantes = Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
      proximas.push({ ...op, diasRestantes });
    }
  }

  let alerta = `🪪 *Licencias / Rev Técnicas — Inggepro*\n📅 ${hoy.toLocaleDateString('es-CL')}\n\n`;

  if (vencidas.length > 0) {
    alerta += `🔴 *LICENCIAS VENCIDAS (${vencidas.length}):*\n`;
    vencidas.forEach(op => alerta += `• ${op.nombre} | ${op.tipo} ${op.patente} | Venció: ${op.licencia}\n`);
    alerta += '\n';
  }
  if (proximas.length > 0) {
    alerta += `🟡 *VENCEN EN 30 DÍAS (${proximas.length}):*\n`;
    proximas.forEach(op => alerta += `• ${op.nombre} | ${op.tipo} ${op.patente} | Vence: ${op.licencia} (${op.diasRestantes} días)\n`);
    alerta += '\n';
  }
  if (recuperacion.length > 0) {
    alerta += `⚠️ *EN RECUPERACIÓN:*\n`;
    recuperacion.forEach(op => alerta += `• ${op.nombre} | ${op.tipo} ${op.patente}\n`);
  }
  if (vencidas.length === 0 && proximas.length === 0 && recuperacion.length === 0) {
    alerta += `✅ Todas las licencias están vigentes.`;
  }

  if (phone) {
    await sendMessage(phone, alerta);
  } else {
    for (const dest of [SEBASTIAN, FRANCISCO_DONETCH, FRANCO_BUSTOS]) {
      await sendMessage(dest, alerta);
    }
  }

  console.log('🪪 Alerta licencias enviada');
}

// ── CHECKLIST DEL DÍA ──
async function reporteChecklistDia(phone) {
  const enviaron = OPERADORES.filter(op => registroDelDia[op.phone]?.enviado);
  const noEnviaron = OPERADORES.filter(op => !registroDelDia[op.phone]?.enviado);
  const fecha = new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });

  let reporte = `📋 *Checklist del Día — Inggepro*\n📅 ${fecha}\n\n`;

  reporte += `✅ *Enviaron (${enviaron.length}):*\n`;
  if (enviaron.length > 0) {
    enviaron.forEach(op => {
      const info = registroDelDia[op.phone];
      reporte += `• ${op.nombre} | ${op.tipo} ${op.patente} | ⏰ ${info.hora} | Riesgo: ${info.riesgo}${info.tieneCriticos ? ' 🚨' : ''}\n`;
    });
  } else {
    reporte += `• Ninguno aún\n`;
  }

  reporte += `\n❌ *No enviaron (${noEnviaron.length}):*\n`;
  if (noEnviaron.length > 0) {
    noEnviaron.forEach(op => reporte += `• ${op.nombre} | ${op.tipo} ${op.patente}\n`);
  } else {
    reporte += `• Todos enviaron ✅\n`;
  }

  await sendMessage(phone, reporte);
}

// ── VERIFICAR REPORTES AUTOMÁTICOS ──
async function verificarReportes() {
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const hora = ahora.toTimeString().slice(0, 5);
  const diaSemana = ahora.getDay();

  verificarDia();

  const esDiaReporte = [1, 3, 5].includes(diaSemana);
  if (hora >= '09:00' && hora <= '09:01' && esDiaReporte && !reporteEnviado) {
    reporteEnviado = true;
    await enviarReporteChecklist();
  }

  if (hora >= '08:00' && hora <= '08:01' && !alertaLicenciasEnviada) {
    alertaLicenciasEnviada = true;
    await verificarLicencias();
  }
}

// ── ENVIAR REPORTE CHECKLIST AUTOMÁTICO ──
async function enviarReporteChecklist() {
  const enviaron = OPERADORES.filter(op => registroDelDia[op.phone]?.enviado);
  const noEnviaron = OPERADORES.filter(op => !registroDelDia[op.phone]?.enviado);
  const fecha = new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });
  const diasSemana = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const dia = diasSemana[new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getDay()];

  let reporte = `📊 *Reporte Checklist Inggepro*\n📅 ${dia} ${fecha} | ⏰ 09:00 AM\n\n`;

  reporte += `✅ *Enviaron (${enviaron.length}):*\n`;
  if (enviaron.length > 0) {
    enviaron.forEach(op => {
      const info = registroDelDia[op.phone];
      reporte += `• ${op.nombre} | ${op.tipo} ${op.patente} | Riesgo: ${info.riesgo} | ⏰ ${info.hora}\n`;
    });
  } else {
    reporte += `• Ninguno\n`;
  }

  reporte += `\n❌ *No enviaron (${noEnviaron.length}):*\n`;
  if (noEnviaron.length > 0) {
    noEnviaron.forEach(op => reporte += `• ${op.nombre} | ${op.tipo} ${op.patente}\n`);
  } else {
    reporte += `• Todos enviaron ✅\n`;
  }

  for (const admin of ADMINS) await sendMessage(admin, reporte);
  await sendMessage(FRANCISCO_PEREIRA, reporte);
  console.log(`📊 Reporte ${dia} enviado`);
}

setInterval(verificarReportes, 60000);

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
    const text = message.text?.body?.trim() || '';
    const esAutorizado = AUTORIZADOS.includes(phone);
    const operador = OPERADORES.find(op => op.phone === phone);

    console.log(`Mensaje de ${phone} | Tipo: ${tipo} | Autorizado: ${esAutorizado}`);

    // ── IMAGEN O DOCUMENTO ──
    if (tipo === 'image' || tipo === 'document') {
      const mediaId = tipo === 'image' ? message.image.id : message.document.id;

      if (!imageBuffer[phone]) imageBuffer[phone] = [];
      imageBuffer[phone].push(mediaId);
      console.log(`📸 Imagen ${imageBuffer[phone].length} recibida de ${phone}`);

      if (imageBuffer[phone].length === 1) {
        await sendMessage(phone, '📨 Foto 1 recibida. Envía la foto 2 para completar.');
        return;
      }

      if (imageBuffer[phone].length >= 2) {
        const mediaId1 = imageBuffer[phone][0];
        const mediaId2 = imageBuffer[phone][1];
        delete imageBuffer[phone];

        const imagen1 = await descargarImagen(mediaId1);
        const imagen2 = await descargarImagen(mediaId2);

        if (imagen1 && imagen2) {
          const nombreOperador = operador ? operador.nombre : phone;
          const patenteOperador = operador ? `${operador.tipo} ${operador.patente}` : '';
          const resultado = await analizarChecklist(imagen1, imagen2, nombreOperador, patenteOperador);

          if (resultado.reenviar) {
            await sendMessage(phone,
`🚫 *FOTOS RECHAZADAS — NO VÁLIDAS*

Las fotos que enviaste NO cumplen los estándares mínimos de calidad. Tu checklist *NO ha sido registrado*.

Para poder registrar tu inspección debes enviar las fotos cumpliendo TODOS estos requisitos:

1️⃣ Coloca el checklist sobre una superficie PLANA y FIRME
2️⃣ Párate sobre la hoja y toma la foto desde ARRIBA, en forma PERPENDICULAR
3️⃣ La hoja COMPLETA debe verse en la foto — sin cortar ningún borde
4️⃣ Debe haber BUENA ILUMINACIÓN — sin sombras sobre el formulario
5️⃣ Espera que la cámara esté bien ENFOCADA antes de disparar
6️⃣ NO muevas la cámara al tomar la foto
7️⃣ Todos los textos y columnas deben leerse con CLARIDAD

⚠️ *Sin checklist válido no puedes iniciar operaciones.*

Envía las 2 fotos nuevamente. 📋`);
            return;
          }

          // Foto buena
          await sendMessage(phone, '✅ Checklist recibido.');

          registroDelDia[phone] = {
            enviado: true,
            hora: new Date().toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' }),
            riesgo: resultado.riesgo,
            tieneCriticos: resultado.tieneCriticos
          };

          const msgChecklist = `📋 *Checklist recibido*\n👤 ${nombreOperador}\n🚛 ${patenteOperador}\n\n${resultado.analisis}`;
          for (const admin of ADMINS) await sendMessage(admin, msgChecklist);
          await sendMessage(FRANCISCO_PEREIRA, msgChecklist);

          if (resultado.tieneCriticos) {
            const msgCritico =
`🚨 *ALERTA CRÍTICA — REVISIÓN INMEDIATA*
👤 ${nombreOperador}
🚛 ${patenteOperador}
⏰ ${registroDelDia[phone].hora}

${resultado.analisis}

⚠️ Este vehículo requiere revisión mecánica INMEDIATA antes de operar.`;
            await sendMessage(FRANCISCO_PEREIRA, msgCritico);
            await sendMessage(SEBASTIAN, msgCritico);
            console.log(`🚨 Alerta crítica - ${nombreOperador}`);
          }
        }
      }
      return;
    }

    // ── MENSAJES DE TEXTO ──
    if (tipo === 'text' && text) {

      // ── ADMINS Y JEFES ──
      if (esAutorizado) {
        if (text === '1') {
          await generarResumenFlota(phone);
          return;
        }
        if (text === '2') {
          await verificarLicencias(phone);
          return;
        }
        if (text === '3') {
          await reporteChecklistDia(phone);
          return;
        }
        // Cualquier otro mensaje muestra el menú
        await sendMessage(phone, MENU_ADMIN);
        return;
      }

      // ── OPERADORES ──
      if (!esAutorizado) {
        await sendMessage(phone, MENU_OPERADOR);
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
    return Buffer.from(imgRes.data).toString('base64');
  } catch (e) {
    console.error('Error descargando imagen:', e.response?.data || e.message);
    return null;
  }
}

// ── ANÁLISIS DE CHECKLIST CON IA ──
async function analizarChecklist(imagen1, imagen2, nombreOperador, patenteOperador) {
  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imagen1 } },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imagen2 } },
            {
              type: 'text',
              text: `Eres Pedro, inspector de seguridad de Inggepro. Analiza estas 2 imágenes del checklist de inspección.

═══════════════════════════════
PASO 1 — CONTROL DE CALIDAD ESTRICTO
═══════════════════════════════
Responde SOLO con la palabra REENVIAR si se cumple CUALQUIERA de estas condiciones:
❌ Foto tomada en ángulo, no perpendicular a la hoja
❌ Algún borde del checklist cortado o fuera del encuadre
❌ Sombras que cubren columnas o filas
❌ Texto o columnas que no se leen con total claridad
❌ Imagen movida, temblorosa o desenfocada
❌ Hoja arrugada, doblada o con pliegues que dificulten lectura
❌ No se distingue claramente la columna CF de las demás
❌ Iluminación insuficiente o zonas oscuras en el formulario
❌ No corresponde a un checklist de inspección de Inggepro
❌ El formulario no se ve completo en ambas fotos

Sé EXTREMADAMENTE estricto. Cualquier duda = REENVIAR.

═══════════════════════════════
PASO 2 — ANÁLISIS
═══════════════════════════════
- Busca ÚNICAMENTE marcas X en columna CF (Con Falla)
- Ignora columnas B (Bueno) y NA (No Aplica)

CLASIFICACIÓN:
🔴 CRÍTICOS: Luces Delanteras, Mandos de Control, Sistema Eléctrico, Neumático de Repuesto, Estanque de Residuos, Estanque Agua Potable, Coplas Manguera Jet, Freno Carrete, Manguera Jet, Freno de Mano, Pedal, Delantero Derecho, Delantero Izquierdo, Trasero Derecho, Trasero Izquierdo, Aceite Motor, Aceite Hidráulico
🟡 MEDIOS: Luces Traseras, Luces Estacionamiento, Portador Tubo Succión
🟢 BAJOS: Luces Laterales Derecha, Luces Laterales Izquierda, Luces de Cabina

Última línea OBLIGATORIA:
NIVEL:CRITICO / NIVEL:MEDIO / NIVEL:BAJO / NIVEL:OK

FORMATO:
🚛 *Análisis Checklist Inggepro*
👤 Operador: ${nombreOperador}
🚛 Vehículo: ${patenteOperador}

📋 *Fallas detectadas (columna CF):*
🔴 Críticas: [lista o "Ninguna"]
🟡 Medias: [lista o "Ninguna"]
🟢 Bajas: [lista o "Ninguna"]

⚠️ *Nivel de riesgo:* BAJO / MEDIO / ALTO / CRÍTICO

📝 *Recomendación:* [acción concreta]

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
    if (texto === 'REENVIAR') return { reenviar: true, analisis: null, riesgo: null, tieneCriticos: false };

    const nivelMatch = texto.match(/NIVEL:(CRITICO|MEDIO|BAJO|OK)/);
    const nivel = nivelMatch ? nivelMatch[1] : 'OK';
    const analisisLimpio = texto.replace(/\nNIVEL:(CRITICO|MEDIO|BAJO|OK)/, '').trim();

    return { reenviar: false, analisis: analisisLimpio, riesgo: nivel, tieneCriticos: nivel === 'CRITICO' };

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
      { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } },
      { headers: { Authorization: `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    console.log(`✅ Mensaje enviado a ${phone}`);
  } catch (e) {
    console.error('Error enviando:', e.response?.data || e.message);
  }
}

app.get('/', (req, res) => res.send('Pedro - FleetCheck Bot activo ✅'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Pedro corriendo en puerto ${PORT}`));
