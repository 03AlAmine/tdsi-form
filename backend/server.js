const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());

// ── CORS : autoriser uniquement ton domaine Angular déployé ──────────────────
const allowedOrigins = [
  'http://localhost:4200',                  // dev local
  'https://ton-app.web.app',                // ← remplace par ton domaine Firebase Hosting
  'https://ton-app.firebaseapp.com'         // ← idem
];

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (Postman, curl en dev)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqué pour l'origine : ${origin}`));
    }
  }
}));

// ── Route de santé (utilisée par Render pour vérifier que le service tourne) ─
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Route principale : proxy vers Groq ──────────────────────────────────────
// Angular appelle POST /api/ai  au lieu d'appeler Groq directement
app.post('/api/ai', async (req, res) => {
  const { messages, response_format, temperature, max_tokens } = req.body;

  // Validation minimale
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] est requis' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // La clé reste côté serveur, jamais envoyée au navigateur
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: temperature ?? 0.3,
        max_tokens: max_tokens ?? 1000,
        ...(response_format ? { response_format } : {})
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Erreur Groq:', response.status, error);
      return res.status(response.status).json({ error: 'Erreur API Groq' });
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Erreur serveur:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur TDSI démarré sur le port ${PORT}`);
});
