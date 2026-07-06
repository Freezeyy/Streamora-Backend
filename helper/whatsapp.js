/**
 * Normalize a value that is already a WhatsApp JID (not a phone number).
 */
function normalizeWhatsAppJid(value) {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed || !trimmed.includes('@')) return null;

  return trimmed;
}

function isPhoneInput(value) {
  if (!value || typeof value !== 'string') return false;
  return !value.trim().includes('@');
}

module.exports = {
  normalizeWhatsAppJid,
  isPhoneInput,
};
