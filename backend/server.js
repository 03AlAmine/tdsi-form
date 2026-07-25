require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const { sendTemplate, TEMPLATES } = require('./mailer');
// ── Middleware ─────────────────────────────────────────────
app.use(express.json());
app.set('trust proxy', 1);

// ── CORS CONFIG (DEV + PROD PROPRE) ───────────────────────
const allowedOrigins = [
  'https://club-tdsi-sign.web.app',
  'https://club-tdsi-sign.firebaseapp.com',
  'https://campus.clubtdsi.sn'
];

app.use(cors({
  origin: function (origin, callback) {

    // ✅ Autorise tous les localhost (peu importe le port Angular)
    if (!origin || origin.startsWith('http://localhost')) {
      return callback(null, true);
    }

    // ✅ Autorise production Firebase
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // ❌ Bloqué sinon
    return callback(new Error('CORS bloqué : ' + origin));
  },
  credentials: true
}));

// ── Gestion preflight OPTIONS (IMPORTANT) ────────────────
app.options('*', cors());

// ── HEALTH CHECK (Render) ─────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ── GROQ AI PROXY ─────────────────────────────────────────
app.post('/api/ai', async (req, res) => {
  const { messages, response_format, temperature, max_tokens } = req.body;

  // Validation
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: 'messages[] est requis'
    });
  }

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: temperature ?? 0.3,
        max_tokens: max_tokens ?? 1000,
        ...(response_format ? { response_format } : {})
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`
        }
      }
    );

    return res.json(response.data);

  } catch (error) {
    console.error('Erreur Groq:', error.response?.data || error.message);

    return res.status(500).json({
      error: 'Erreur API Groq'
    });
  }
});

// ── EMAIL — envoi transactionnel (SMTP OVH) ────────────────
// Le front n'envoie jamais de HTML : uniquement un nom de template
// (whitelist dans mailer.js) + des données. Ça évite qu'un appel
// malveillant transforme ce endpoint en relais spam générique.
//
// Protection légère : clé partagée (mêmes garanties que le reste de
// cette API, qui n'a pas d'auth utilisateur) + rate-limit mémoire par
// IP. Suffisant pour un club étudiant, pas un rempart absolu — si le
// volume d'abus augmente, passer par un vrai service (Resend, SES...).
const emailRateLimit = new Map(); // ip -> [timestamps]
const EMAIL_RATE_WINDOW_MS = 60_000;
const EMAIL_RATE_MAX = 20;

app.post('/api/email', async (req, res) => {
  const apiKey = req.get('x-email-key');
  if (!process.env.EMAIL_API_KEY || apiKey !== process.env.EMAIL_API_KEY) {
    return res.status(401).json({ error: 'Clé API email invalide' });
  }

  const ip = req.ip;
  const now = Date.now();
  const hits = (emailRateLimit.get(ip) || []).filter((t) => now - t < EMAIL_RATE_WINDOW_MS);
  if (hits.length >= EMAIL_RATE_MAX) {
    return res.status(429).json({ error: 'Trop de requêtes email, réessaie dans une minute' });
  }
  hits.push(now);
  emailRateLimit.set(ip, hits);

  const { template, to, data } = req.body;

  if (!template || !TEMPLATES[template]) {
    return res.status(400).json({ error: `Template inconnu. Valeurs possibles: ${Object.keys(TEMPLATES).join(', ')}` });
  }
  if (!to) {
    return res.status(400).json({ error: '"to" est requis (string ou tableau)' });
  }

  try {
    await sendTemplate(template, to, data);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Erreur envoi email:', error.message);
    return res.status(500).json({ error: "Échec de l'envoi de l'email" });
  }
});

// ── START SERVER ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const tls = require("tls");

const socket = tls.connect(
  {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    servername: process.env.SMTP_HOST,
    timeout: 10000,
  },
  () => {
    console.log("TLS CONNECT OK");
    socket.end();
  }
);

socket.on("timeout", () => {
  console.log("TLS TIMEOUT");
  socket.destroy();
});

socket.on("error", (err) => {
  console.error("TLS ERROR:", err);
});
app.listen(PORT, () => {
  console.log(`Serveur TDSI démarré sur le port ${PORT}`);
});
