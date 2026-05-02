/**
 * Logo officiel Confidance (identique à la navbar : icône C + texte avec dégradé).
 * Encodé en data URI pour affichage fiable dans les emails (pas de dépendance à une URL externe).
 */
const OFFICIAL_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 48" fill="none" role="img" aria-label="Confidance">
  <defs>
    <linearGradient id="confidance-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="40" height="40" rx="10" fill="url(#confidance-gradient)"/>
  <text x="20" y="28" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="22">C</text>
  <text x="52" y="28" fill="url(#confidance-gradient)" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="22">Confidance</text>
</svg>`;

function getLogoDataUri() {
  try {
    const base64 = Buffer.from(OFFICIAL_LOGO_SVG, 'utf8').toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch (_) {
    return null;
  }
}

module.exports = { getLogoDataUri };
