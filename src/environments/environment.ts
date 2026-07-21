export const environment = {
  production: false,
  // URL publique du site — sert au SEO (canonical, og:url, JSON-LD)
  siteUrl: 'https://campus.clubtdsi.sn',
  apiUrl: 'http://localhost:3000',
  // Doit correspondre à EMAIL_API_KEY côté backend (voir tdsi-backend/.env)
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
