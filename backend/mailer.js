// mailer.js — Envoi d'emails transactionnels via le SMTP OVH.
// Un seul endroit pour : la connexion SMTP, l'habillage HTML (branding
// TDSI, façon "console tech" cohérente avec le design system du site)
// et les "templates" métier. Le serveur reste petit et lisible :
// server.js ne fait qu'appeler buildTemplate(name, data) puis sendMail().

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

transporter.verify((err, success) => {
  if (err) {
    console.error("SMTP VERIFY ERROR:");
    console.error(err);
  } else {
    console.log("SMTP READY");
  }
});
console.log({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
});
const FROM = process.env.MAIL_FROM || `"Campus Club TDSI" <${process.env.SMTP_USER}>`;
const SITE_URL = process.env.FRONTEND_URL || 'https://campus.clubtdsi.sn';

// ── Palette ──────────────────────────────────────────────────────
// Reprise 1:1 de _variables.scss (thème "tech" du site). Tout est en
// styles inline et tables : contraignant, mais c'est ce qui rend
// correctement dans Gmail/Outlook/Apple Mail, contrairement au CSS
// "moderne" (grid, backdrop-filter, custom properties…).
const C = {
  bg: '#0a0e27',
  card: '#12163a',
  cardBorder: 'rgba(0, 212, 255, 0.18)',
  divider: 'rgba(0, 212, 255, 0.12)',
  dashed: 'rgba(255, 255, 255, 0.12)',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  cyan: '#00d4ff',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  gradient: 'linear-gradient(135deg,#00d4ff 0%,#3b82f6 50%,#8b5cf6 100%)',
};

const FONT = "'JetBrains Mono', 'Courier New', Consolas, monospace";
const SANS = "Arial, Helvetica, sans-serif";

// ── Petits composants HTML réutilisables ────────────────────────

// Barre "chrome" façon terminal (3 pastilles + label mono) — même
// patron visuel que .filters-section__chrome / .td__card-chrome sur
// le site. Purement décoratif, ça pose immédiatement l'univers "tech"
// avant même d'avoir lu un mot du contenu.
function chromeBar(label) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:14px 24px; border-bottom:1px solid ${C.divider};">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:6px;"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ff5f57;"></span></td>
              <td style="padding-right:6px;"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#febc2e;"></span></td>
              <td style="padding-right:14px;"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#28c840;"></span></td>
              <td style="font-family:${FONT}; font-size:11px; letter-spacing:0.04em; color:${C.textFaint};">
                ${label}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

// Badge de statut (pastille + texte), même famille que .td__badge /
// .wd__status côté front — un mot-clé courte en majuscules mono.
function statusBadge({ label, color = C.cyan, bg = 'rgba(0, 212, 255, 0.1)', border = 'rgba(0, 212, 255, 0.3)' }) {
  return `
    <span style="display:inline-block; padding:4px 12px; border-radius:999px; border:1px solid ${border};
                  background:${bg}; font-family:${FONT}; font-size:11px; font-weight:700;
                  letter-spacing:0.06em; color:${color}; text-transform:uppercase;">
      ● ${label}
    </span>`;
}

// Bouton CTA — dégradé + ombre "glow", cohérent avec .btn--primary.
function ctaButton(text, link) {
  if (!text || !link) return '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:28px 0 4px;">
          <a href="${link}" target="_blank"
             style="display:inline-block; padding:15px 34px; border-radius:12px;
                    background:${C.gradient};
                    color:#ffffff; font-family:${SANS}; font-size:14px;
                    font-weight:700; letter-spacing:0.02em; text-decoration:none;
                    box-shadow:0 8px 24px rgba(0,212,255,0.35);">
            ${text} &nbsp;→
          </a>
        </td>
      </tr>
    </table>`;
}

// Ligne "clé: valeur" façon fiche technique (.wd__row / .td__meta-row) —
// pratique pour afficher date / animateur / lieu sans réinventer une
// mise en page à chaque template.
function metaRows(rows) {
  const items = rows.filter((r) => r && r.value);
  if (!items.length) return '';
  const trs = items
    .map(
      (r, i) => `
      <tr>
        <td style="padding:9px 0; ${i < items.length - 1 ? `border-bottom:1px dashed ${C.dashed};` : ''}
                    font-family:${FONT}; font-size:11px; letter-spacing:0.04em;
                    color:${C.textFaint}; text-transform:uppercase; white-space:nowrap; width:1%;">
          ${r.icon || ''} ${r.label}
        </td>
        <td style="padding:9px 0 9px 16px; ${i < items.length - 1 ? `border-bottom:1px dashed ${C.dashed};` : ''}
                    font-family:${SANS}; font-size:14px; color:${C.text}; text-align:right;">
          ${r.value}
        </td>
      </tr>`
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin-top:20px; background:rgba(0,212,255,0.04); border:1px solid ${C.cardBorder};
                  border-radius:12px; padding:4px 18px;">
      ${trs}
    </table>`;
}

// ── Habillage HTML commun ───────────────────────────────────────
function layout({ title, preheader = '', eyebrow, badge, bodyHtml, meta, ctaText, ctaLink, chromeLabel = 'tdsi@campus:~$ mailer' }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:${C.bg}; font-family:${SANS};">
  <span style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background-color:${C.bg}; background-image:radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,212,255,0.08), transparent 70%); padding:36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:560px; background-color:${C.card}; border-radius:18px; overflow:hidden; border:1px solid ${C.cardBorder};">

          <!-- Chrome terminal -->
          ${chromeBar(chromeLabel)}

          <!-- Header dégradé -->
          <tr>
            <td style="background:${C.gradient}; padding:26px 32px; position:relative;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:${SANS}; font-size:19px; font-weight:800; color:#ffffff; letter-spacing:0.3px;">
                    🛡️&nbsp; Campus Club TDSI
                  </td>
                  <td align="right" style="font-family:${FONT}; font-size:10px; color:rgba(255,255,255,0.85); letter-spacing:0.08em;">
                    CAMPUS&nbsp;·&nbsp;UCAD&nbsp;DAKAR
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="padding:34px 32px 6px;">
              ${eyebrow ? `<div style="font-family:${FONT}; font-size:11px; letter-spacing:0.08em; color:${C.cyan}; text-transform:uppercase; margin-bottom:10px;">${eyebrow}</div>` : ''}

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-family:${SANS}; font-size:21px; font-weight:800; color:#ffffff; line-height:1.3;">
                    ${title}
                  </td>
                  ${badge ? `<td align="right" style="white-space:nowrap; vertical-align:top;">${badge}</td>` : ''}
                </tr>
              </table>

              <div style="margin-top:16px; font-family:${SANS}; font-size:15px; line-height:1.65; color:${C.textMuted};">
                ${bodyHtml}
              </div>

              ${meta || ''}
            </td>
          </tr>

          ${ctaButton(ctaText, ctaLink)}

          <tr><td style="padding:14px;"></td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 26px; border-top:1px solid ${C.divider};">
              <p style="margin:0 0 6px; font-family:${FONT}; font-size:10px; letter-spacing:0.06em; color:${C.textFaint}; text-transform:uppercase;">
                Transmission de Données &amp; Sécurité de l'Information
              </p>
              <p style="margin:0; font-family:${SANS}; font-size:12px; color:${C.textFaint}; line-height:1.6;">
                Vous recevez cet email suite à une action sur votre compte
                <a href="${SITE_URL}" style="color:${C.blue}; text-decoration:none;">campus.clubtdsi.sn</a>.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:18px 0 0; font-family:${FONT}; font-size:10px; letter-spacing:0.05em; color:${C.textFaint};">
          © ${new Date().getFullYear()} Campus Club TDSI — généré automatiquement, merci de ne pas répondre à cet email.
        </p>
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
    subject: 'Bienvenue au Campus du Club TDSI 🎉',
    html: layout({
      title: `Bienvenue, ${d.displayName} !`,
      preheader: 'Ton compte Campus  Club TDSI est prêt.',
      eyebrow: 'ACCOUNT_CREATED',
      chromeLabel: 'tdsi@campus:~$ welcome --new-member',
      badge: statusBadge({ label: 'Actif', color: C.success, bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' }),
      bodyHtml: `
        <p style="margin:0 0 12px;">Ton inscription au <strong style="color:#fff;">Campus Club TDSI</strong> (Transmission de Données et Sécurité de l'Information) est confirmée.</p>
        <p style="margin:0;">Tu peux dès maintenant explorer les thématiques proposées, t'inscrire aux workshops et proposer tes propres sujets.</p>`,
      ctaText: 'Accéder à mon espace',
      ctaLink: `${SITE_URL}/espace-membre`,
    }),
  }),

  theme_created: (d) => ({
    subject: `Nouvelle thématique : ${d.themeTitle}`,
    html: layout({
      title: 'Nouvelle thématique disponible',
      preheader: d.themeTitle,
      eyebrow: 'CATALOGUE_UPDATE',
      chromeLabel: 'tdsi@campus:~$ themes --new',
      badge: statusBadge({ label: 'Nouveau', color: C.cyan }),
      bodyHtml: `
        <p style="margin:0 0 14px;">Une nouvelle thématique vient d'être publiée :</p>
        <p style="margin:0; font-size:17px; font-weight:700; color:#ffffff;">« ${d.themeTitle} »</p>
        <p style="margin:14px 0 0;">Manifeste ton intérêt dès maintenant si le sujet te plaît — cela aide les admins à programmer le workshop.</p>`,
      ctaText: 'Voir la thématique',
      ctaLink: `${SITE_URL}/themes`,
    }),
  }),

  workshop_created: (d) => ({
    subject: `Nouvel atelier programmé : ${d.themeTitle}`,
    html: layout({
      title: 'Nouvel atelier programmé',
      preheader: `${d.themeTitle} — ${fmtDate(d.date)}`,
      eyebrow: 'SESSIONS_INDEX',
      chromeLabel: 'tdsi@campus:~$ workshops --schedule',
      badge: statusBadge({ label: 'Planifié', color: C.cyan }),
      bodyHtml: `
        <p style="margin:0 0 14px;">Un nouvel atelier vient d'être programmé :</p>
        <p style="margin:0; font-size:17px; font-weight:700; color:#ffffff;">« ${d.themeTitle} »</p>
        <p style="margin:14px 0 0;">Les places sont limitées, inscris-toi dès que possible.</p>`,
      meta: metaRows([
        { icon: '🧑‍🏫', label: 'Animé par', value: d.presenter },
        { icon: '📅', label: 'Date', value: fmtDate(d.date) },
      ]),
      ctaText: "S'inscrire à l'atelier",
      ctaLink: `${SITE_URL}/workshops`,
    }),
  }),

  workshop_cancelled: (d) => ({
    subject: `Atelier annulé : ${d.themeTitle}`,
    html: layout({
      title: 'Atelier annulé',
      preheader: d.themeTitle,
      eyebrow: 'SESSIONS_INDEX',
      chromeLabel: 'tdsi@campus:~$ workshops --cancel',
      badge: statusBadge({ label: 'Annulé', color: C.danger, bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' }),
      bodyHtml: `
        <p style="margin:0 0 12px;">L'atelier <strong style="color:#fff;">« ${d.themeTitle} »</strong> auquel tu étais inscrit·e a été annulé.</p>
        <p style="margin:0;">Toutes nos excuses pour la gêne occasionnée. N'hésite pas à consulter les autres ateliers disponibles.</p>`,
      ctaText: 'Voir les ateliers',
      ctaLink: `${SITE_URL}/workshops`,
    }),
  }),

  waitlist_promoted: (d) => ({
    subject: `Une place s'est libérée : ${d.themeTitle}`,
    html: layout({
      title: "Une place s'est libérée",
      preheader: d.themeTitle,
      eyebrow: 'WAITLIST_UPDATE',
      chromeLabel: 'tdsi@campus:~$ waitlist --promote',
      badge: statusBadge({ label: 'Inscrit', color: C.success, bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' }),
      bodyHtml: `
        <p style="margin:0 0 12px;">Tu étais en file d'attente pour <strong style="color:#fff;">« ${d.themeTitle} »</strong>.</p>
        <p style="margin:0;">Une place vient de se libérer et tu es maintenant <strong style="color:#fff;">inscrit·e</strong> à l'atelier !</p>`,
      ctaText: 'Voir mes ateliers',
      ctaLink: `${SITE_URL}/workshops`,
    }),
  }),

  submission_received_student: (d) => ({
    subject: 'Proposition bien reçue ✅',
    html: layout({
      title: 'Ta proposition a bien été envoyée',
      preheader: d.proposedTitle,
      eyebrow: 'SUBMISSION_QUEUE',
      chromeLabel: 'tdsi@campus:~$ submissions --status pending',
      badge: statusBadge({ label: 'En attente', color: C.warning, bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' }),
      bodyHtml: `
        <p style="margin:0 0 14px;">Nous avons bien reçu ta proposition de thématique :</p>
        <p style="margin:0; font-size:17px; font-weight:700; color:#ffffff;">« ${d.proposedTitle} »</p>
        <p style="margin:14px 0 0;">L'équipe admin va l'étudier. Tu recevras un email dès qu'une décision sera prise.</p>`,
      ctaText: 'Suivre ma proposition',
      ctaLink: `${SITE_URL}/espace-membre/mes-soumissions`,
    }),
  }),

  submission_received_admin: (d) => ({
    subject: `Nouvelle proposition à valider : ${d.proposedTitle}`,
    html: layout({
      title: 'Nouvelle proposition de thématique',
      preheader: `${d.studentName} — ${d.proposedTitle}`,
      eyebrow: 'ADMIN_QUEUE',
      chromeLabel: 'tdsi@campus:~$ admin/submissions --new',
      badge: statusBadge({ label: 'À valider', color: C.purple, bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)' }),
      bodyHtml: `
        <p style="margin:0 0 14px;"><strong style="color:#fff;">${d.studentName}</strong> a proposé une nouvelle thématique :</p>
        <p style="margin:0; font-size:17px; font-weight:700; color:#ffffff;">« ${d.proposedTitle} »</p>
        <p style="margin:14px 0 0;">Rendez-vous sur le tableau de bord admin pour l'étudier.</p>`,
      ctaText: 'Traiter la demande',
      ctaLink: `${SITE_URL}/admin/soumissions`,
    }),
  }),

  submission_approved: (d) => ({
    subject: 'Ta proposition a été approuvée 🎉',
    html: layout({
      title: 'Proposition approuvée',
      preheader: d.proposedTitle,
      eyebrow: 'SUBMISSION_QUEUE',
      chromeLabel: 'tdsi@campus:~$ submissions --status approved',
      badge: statusBadge({ label: 'Approuvé', color: C.success, bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' }),
      bodyHtml: `
        <p style="margin:0 0 12px;">Bonne nouvelle ! Ta proposition <strong style="color:#fff;">« ${d.proposedTitle} »</strong> a été approuvée et est maintenant une thématique ouverte au club.</p>
        <p style="margin:0;">Un workshop pourra y être programmé prochainement.</p>`,
      ctaText: 'Voir la thématique',
      ctaLink: `${SITE_URL}/espace-membre/mes-soumissions`,
    }),
  }),

  submission_refused: (d) => ({
    subject: 'Réponse à ta proposition de thématique',
    html: layout({
      title: 'Proposition non retenue',
      preheader: d.proposedTitle,
      eyebrow: 'SUBMISSION_QUEUE',
      chromeLabel: 'tdsi@campus:~$ submissions --status refused',
      badge: statusBadge({ label: 'Non retenu', color: C.textFaint, bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.25)' }),
      bodyHtml: `
        <p style="margin:0 0 12px;">Ta proposition <strong style="color:#fff;">« ${d.proposedTitle} »</strong> n'a pas été retenue cette fois-ci.</p>
        ${d.comment ? `<p style="margin:0 0 12px; padding:12px 14px; background:rgba(255,255,255,0.04); border-left:2px solid ${C.textFaint}; border-radius:6px;"><strong style="color:#fff;">Motif :</strong> ${d.comment}</p>` : ''}
        <p style="margin:0;">N'hésite pas à proposer d'autres sujets — chaque contribution compte !</p>`,
      ctaText: 'Proposer une autre thématique',
      ctaLink: `${SITE_URL}/espace-membre/proposer`,
    }),
  }),

  theme_interest_threshold: (d) => ({
    subject: `Thématique très demandée : ${d.themeTitle}`,
    html: layout({
      title: 'Thématique très demandée',
      preheader: d.themeTitle,
      eyebrow: 'ADMIN_ALERT',
      chromeLabel: 'tdsi@campus:~$ analytics --threshold-alert',
      badge: statusBadge({ label: 'Tendance', color: C.warning, bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' }),
      bodyHtml: `
        <p style="margin:0;"><strong style="color:#fff;">« ${d.themeTitle} »</strong> a atteint <strong style="color:${C.cyan};">${d.count} membres intéressés</strong>.</p>
        <p style="margin:12px 0 0;">Envisagez de programmer un atelier sur ce sujet.</p>`,
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
