function getWhatsAppBotConfig() {
  const number = (process.env.WHATSAPP_BOT_NUMBER || '').trim();
  const display = (process.env.WHATSAPP_BOT_DISPLAY || 'SNOW Events Bot').trim();
  const digits = number.replace(/\D/g, '');

  return {
    number: number || null,
    display,
    waLink: digits ? `https://wa.me/${digits}` : null,
  };
}

module.exports = { getWhatsAppBotConfig };
