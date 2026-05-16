require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

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

// ── START SERVER ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serveur TDSI démarré sur le port ${PORT}`);
});
