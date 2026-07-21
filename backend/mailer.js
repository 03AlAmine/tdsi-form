// mailer.js — Envoi d'emails transactionnels via le SMTP OVH.
// Un seul endroit pour : la connexion SMTP, l'habillage HTML (branding
// TDSI) et les "templates" métier. Le serveur reste petit et lisible :
// server.js ne fait qu'appeler buildTemplate(name, data) puis sendMail().

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465, // 465 = SSL direct, 587 = STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.MAIL_FROM || `"Club TDSI" <${process.env.SMTP_USER}>`;
const SITE_URL = process.env.FRONTEND_URL || 'https://campus.clubtdsi.sn';

// ── Habillage HTML commun ───────────────────────────────────────
// Palette reprise de _variables.scss (thème "tech" du site : navy
// profond + dégradé cyan → bleu → violet). Tout est en styles inline
// et tables : c'est contraignant, mais c'est ce qui rend correctement
// dans Gmail/Outlook/Apple Mail, contrairement au CSS "moderne".
function layout({ title, preheader = '', bodyHtml, ctaText, ctaLink }) {
  const cta = ctaText && ctaLink
    ? `
      <tr>
        <td align="center" style="padding: 8px 0 4px;">
          <a href="${ctaLink}" target="_blank"
             style="display:inline-block; padding:14px 32px; border-radius:10px;
                    background:linear-gradient(135deg,#00d4ff 0%,#3b82f6 50%,#8b5cf6 100%);
                    color:#ffffff; font-family:Arial,Helvetica,sans-serif; font-size:15px;
                    font-weight:700; text-decoration:none;">
            ${ctaText}
          </a>
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#0a0e27; font-family:Arial,Helvetica,sans-serif;">
  <span style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0e27; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#161c3f; border-radius:16px; overflow:hidden; border:1px solid rgba(0,212,255,0.2);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#00d4ff 0%,#3b82f6 50%,#8b5cf6 100%); padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif; font-size:20px; font-weight:800; color:#ffffff; letter-spacing:0.5px;">
                    🔐 Club TDSI
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 8px;">
              <h1 style="margin:0 0 20px; font-family:Arial,Helvetica,sans-serif; font-size:20px; color:#ffffff;">${title}</h1>
              <div style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:1.6; color:#cbd5e1;">
                ${bodyHtml}
              </div>
            </td>
          </tr>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${cta}
          </table>
          <tr><td style="padding:24px;"></td></tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; border-top:1px solid rgba(0,212,255,0.15);">
              <p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#64748b; line-height:1.6;">
                Transmission de Données et Sécurité de l'Information — ESP Dakar<br>
                Vous recevez cet email suite à une action sur votre compte
                <a href="${SITE_URL}" style="color:#3b82f6;">campus.clubtdsi.sn</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── Templates métier ────────────────────────────────────────────
// Chaque builder reçoit `data` (validé côté route) et retourne
// { subject, html }. Whitelist unique de la vérité côté serveur :
// le front ne choisit qu'un nom de template + des données, jamais
// le HTML lui-même.
const TEMPLATES = {
  welcome: (d) => ({
    subject: 'Bienvenue au Club TDSI 🎉',
    html: layout({
      title: `Bienvenue, ${d.displayName} !`,
      preheader: 'Ton compte Club TDSI est prêt.',
      bodyHtml: `
        <p>Ton inscription au <strong>Club TDSI</strong> (Transmission de Données et Sécurité de l'Information) est confirmée.</p>
        <p>Tu peux dès maintenant explorer les thématiques proposées, t'inscrire aux workshops et proposer tes propres sujets.</p>
        <p>À très vite !</p>`,
      ctaText: 'Accéder à mon espace',
      ctaLink: `${SITE_URL}/espace-membre`,
    }),
  }),

  theme_created: (d) => ({
    subject: `Nouvelle thématique : ${d.themeTitle}`,
    html: layout({
      title: 'Nouvelle thématique disponible 📚',
      preheader: d.themeTitle,
      bodyHtml: `
        <p>Une nouvelle thématique vient d'être publiée :</p>
        <p style="font-size:17px; font-weight:700; color:#ffffff;">« ${d.themeTitle} »</p>
        <p>Manifeste ton intérêt dès maintenant si le sujet te plaît — cela aide les admins à programmer le workshop.</p>`,
      ctaText: 'Voir la thématique',
      ctaLink: `${SITE_URL}/themes`,
    }),
  }),

  workshop_created: (d) => ({
    subject: `Nouvel atelier programmé : ${d.themeTitle}`,
    html: layout({
      title: 'Nouvel atelier programmé 📅',
      preheader: `${d.themeTitle} — ${fmtDate(d.date)}`,
      bodyHtml: `
        <p>Un nouvel atelier vient d'être programmé :</p>
        <p style="font-size:17px; font-weight:700; color:#ffffff;">« ${d.themeTitle} »</p>
        <p>Animé par <strong>${d.presenter}</strong><br>
        📆 ${fmtDate(d.date)}</p>
        <p>Les places sont limitées, inscris-toi dès que possible.</p>`,
      ctaText: "S'inscrire à l'atelier",
      ctaLink: `${SITE_URL}/workshops`,
    }),
  }),

  workshop_cancelled: (d) => ({
    subject: `Atelier annulé : ${d.themeTitle}`,
    html: layout({
      title: 'Atelier annulé',
      preheader: d.themeTitle,
      bodyHtml: `
        <p>L'atelier <strong>« ${d.themeTitle} »</strong> auquel tu étais inscrit·e a été annulé.</p>
        <p>Toutes nos excuses pour la gêne occasionnée. N'hésite pas à consulter les autres ateliers disponibles.</p>`,
      ctaText: 'Voir les ateliers',
      ctaLink: `${SITE_URL}/workshops`,
    }),
  }),

  waitlist_promoted: (d) => ({
    subject: `Une place s'est libérée : ${d.themeTitle}`,
    html: layout({
      title: "Une place s'est libérée 🎉",
      preheader: d.themeTitle,
      bodyHtml: `
        <p>Tu étais en file d'attente pour <strong>« ${d.themeTitle} »</strong>.</p>
        <p>Une place vient de se libérer et tu es maintenant <strong>inscrit·e</strong> à l'atelier !</p>`,
      ctaText: 'Voir mes ateliers',
      ctaLink: `${SITE_URL}/workshops`,
    }),
  }),

  submission_received_student: (d) => ({
    subject: 'Proposition bien reçue ✅',
    html: layout({
      title: 'Ta proposition a bien été envoyée',
      preheader: d.proposedTitle,
      bodyHtml: `
        <p>Nous avons bien reçu ta proposition de thématique :</p>
        <p style="font-size:17px; font-weight:700; color:#ffffff;">« ${d.proposedTitle} »</p>
        <p>L'équipe admin va l'étudier. Tu recevras un email dès qu'une décision sera prise.</p>`,
      ctaText: 'Suivre ma proposition',
      ctaLink: `${SITE_URL}/espace-membre/mes-soumissions`,
    }),
  }),

  submission_received_admin: (d) => ({
    subject: `Nouvelle proposition à valider : ${d.proposedTitle}`,
    html: layout({
      title: 'Nouvelle proposition de thématique 📥',
      preheader: `${d.studentName} — ${d.proposedTitle}`,
      bodyHtml: `
        <p><strong>${d.studentName}</strong> a proposé une nouvelle thématique :</p>
        <p style="font-size:17px; font-weight:700; color:#ffffff;">« ${d.proposedTitle} »</p>
        <p>Rendez-vous sur le tableau de bord admin pour l'étudier.</p>`,
      ctaText: 'Traiter la demande',
      ctaLink: `${SITE_URL}/admin/soumissions`,
    }),
  }),

  submission_approved: (d) => ({
    subject: 'Ta proposition a été approuvée 🎉',
    html: layout({
      title: 'Proposition approuvée 🎉',
      preheader: d.proposedTitle,
      bodyHtml: `
        <p>Bonne nouvelle ! Ta proposition <strong>« ${d.proposedTitle} »</strong> a été approuvée et est maintenant une thématique ouverte au club.</p>
        <p>Un workshop pourra y être programmé prochainement.</p>`,
      ctaText: 'Voir la thématique',
      ctaLink: `${SITE_URL}/espace-membre/mes-soumissions`,
    }),
  }),

  submission_refused: (d) => ({
    subject: 'Réponse à ta proposition de thématique',
    html: layout({
      title: 'Proposition non retenue',
      preheader: d.proposedTitle,
      bodyHtml: `
        <p>Ta proposition <strong>« ${d.proposedTitle} »</strong> n'a pas été retenue cette fois-ci.</p>
        ${d.comment ? `<p><strong>Motif :</strong> ${d.comment}</p>` : ''}
        <p>N'hésite pas à proposer d'autres sujets — chaque contribution compte !</p>`,
      ctaText: 'Proposer une autre thématique',
      ctaLink: `${SITE_URL}/espace-membre/proposer`,
    }),
  }),

  theme_interest_threshold: (d) => ({
    subject: `Thématique très demandée : ${d.themeTitle}`,
    html: layout({
      title: 'Thématique très demandée 🔥',
      preheader: d.themeTitle,
      bodyHtml: `
        <p><strong>« ${d.themeTitle} »</strong> a atteint <strong>${d.count} membres intéressés</strong>.</p>
        <p>Envisagez de programmer un atelier sur ce sujet.</p>`,
      ctaText: 'Voir les thématiques',
      ctaLink: `${SITE_URL}/admin/themes`,
    }),
  }),
};

// ── Envoi ────────────────────────────────────────────────────────
// `to` peut être une string ou un tableau. On envoie en Bcc quand il
// y a plusieurs destinataires (annonce groupée) pour ne jamais
// exposer la liste des emails entre membres.
async function sendTemplate(templateName, to, data) {
  const build = TEMPLATES[templateName];
  if (!build) throw new Error(`Template email inconnu: ${templateName}`);

  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) return { skipped: true, reason: 'no-recipients' };

  const { subject, html } = build(data || {});

  const mailOptions = { from: FROM, subject, html };
  if (recipients.length === 1) {
    mailOptions.to = recipients[0];
  } else {
    // Envoi groupé (annonce à tous les étudiants, etc.) : Bcc pour la
    // confidentialité, "To" pointe vers l'adresse générique du club.
    mailOptions.to = FROM;
    mailOptions.bcc = recipients;
  }

  return transporter.sendMail(mailOptions);
}

module.exports = { sendTemplate, TEMPLATES };
