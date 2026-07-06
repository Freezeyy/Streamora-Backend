const { normalizeWhatsAppJid } = require('../helper/whatsapp');

const DEFAULT_CHATBOT_API_URL = 'https://chatbot.4fource.com';

function mapChatbotEvent(event) {
  return {
    id: event.id,
    eventTitle: event.title,
    date: event.date,
    eventTime: event.time,
    chatId: event.chatId || null,
    groupName: event.groupName || null,
    notes: event.groupName ? null : (event.chatId ? `Group: ${event.chatId}` : null),
    createdBy: event.createdBy,
    createdByJid: event.createdByJid,
    eventDatetime: event.eventDatetime,
    reminderDatetime: event.reminderDatetime,
    source: 'whatsapp',
  };
}

async function resolveJidFromPhone(phone) {
  const baseUrl = (process.env.CHATBOT_API_URL || DEFAULT_CHATBOT_API_URL).replace(/\/$/, '');
  const url = `${baseUrl}/api/resolve-jid?phone=${encodeURIComponent(phone.trim())}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || !data.ok) {
    return {
      jid: null,
      error: data.error || `Resolve failed (${response.status})`,
      source: data.source || null,
    };
  }

  return {
    jid: data.jid,
    error: null,
    source: data.source || null,
  };
}

async function fetchEventsForUser(jid, { limit, upcoming = true } = {}) {
  const normalizedJid = normalizeWhatsAppJid(jid) || jid;
  if (!normalizedJid) {
    throw new Error('Invalid WhatsApp JID');
  }

  const baseUrl = (process.env.CHATBOT_API_URL || DEFAULT_CHATBOT_API_URL).replace(/\/$/, '');
  const params = new URLSearchParams({
    jid: normalizedJid,
    upcoming: upcoming ? '1' : '0',
  });
  if (limit) {
    params.set('limit', String(limit));
  }

  const url = `${baseUrl}/api/events/for-user?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Chatbot API error (${response.status})`);
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || 'Chatbot API returned an error');
  }

  return {
    events: (data.events || []).map(mapChatbotEvent),
    groups: data.groups || [],
  };
}

/** @deprecated Use fetchEventsForUser — kept for compatibility */
async function fetchEventsByJid(jid) {
  const { events } = await fetchEventsForUser(jid);
  return events;
}

module.exports = {
  fetchEventsByJid,
  fetchEventsForUser,
  resolveJidFromPhone,
  mapChatbotEvent,
};
