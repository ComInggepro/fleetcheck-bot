const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const META_TOKEN = process.env.META_TOKEN;
const META_PHONE_ID = process.env.META_PHONE_ID;
const GEMINI_KEY = process.env.GEMINI_KEY;
const VERIFY_TOKEN = 'fleetcheck2024';

// Verificación del webhook de Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Recibir mensajes
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message) return;

    const phone = message.from;
    const text = message.text?.body || '';
    const tipo = message.type;

    console.log('PHONE:', phone);
    console.log('TEXT:', text);
    console.log('TIPO:', tipo);

    if (tipo === 'image' || tipo === 'document') {
      await sendMessage(phone, '📋 Recibí tu chec
