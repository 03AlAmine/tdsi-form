export const environment = {
  production: true,
  // URL publique du site — sert au SEO (canonical, og:url, JSON-LD)
  siteUrl: 'https://campus.clubtdsi.sn',
  // Backend Node.js en local (npm run dev dans tdsi-backend/)
  apiUrl: 'https://club-tdsi-campus.onrender.com',
  // Doit correspondre à EMAIL_API_KEY sur Render (variables d'environnement)
  emailApiKey: 'ad277e88e9cab0251dab22c16bea3b5a96fe935830f4a2a4',
  firebase: {
    apiKey: 'AIzaSyD-bglX-I4R6XYKFegytaPvlO7nGdwCOzA',
    authDomain: 'club-tdsi-sign.firebaseapp.com',
    projectId: 'club-tdsi-sign',
    storageBucket: 'club-tdsi-sign.firebasestorage.app',
    messagingSenderId: '678736983707',
    appId: '1:678736983707:web:aa511e81610c8881e2f83e',
  },
};
