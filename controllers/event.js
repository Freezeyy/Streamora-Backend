const m = require('../models');
const svc = require('../services');
const { getWhatsAppBotConfig } = require('../helper/whatsappBot');

function mapSnowEvent(record) {
  const row = record.toJSON ? record.toJSON() : record;
  return {
    id: `snow-${row.id}`,
    snowId: row.id,
    eventTitle: row.eventTitle,
    date: row.date,
    eventTime: row.eventTime || 'All day',
    notes: row.notes,
    source: 'snow',
  };
}

async function resolveUserJid(user) {
  if (user.whatsapp_jid) {
    return user.whatsapp_jid;
  }

  const phone = (user.phone || '').trim();
  if (!phone) {
    return null;
  }

  const resolved = await svc.chatbotEvents.resolveJidFromPhone(phone);
  if (resolved.jid) {
    await user.update({ whatsapp_jid: resolved.jid });
    return resolved.jid;
  }

  return null;
}

async function createEvent(req, res) {
  try {
    const { eventTitle, date, eventTime, notes } = req.body;

    if (!eventTitle || !date) {
      return res.status(400).json({ message: 'eventTitle and date are required' });
    }

    const event = await m.Event.create({
      user_id: req.user.id,
      eventTitle,
      date,
      eventTime: eventTime || 'All day',
      notes: notes || null,
    });

    res.status(201).json(mapSnowEvent(event));
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function updateEvent(req, res) {
  try {
    const { eventId } = req.params;
    const event = await m.Event.findByPk(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (Number(event.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'You can only edit your own events' });
    }

    const { eventTitle, date, eventTime, notes } = req.body;

    await event.update({
      eventTitle: eventTitle ?? event.eventTitle,
      date: date ?? event.date,
      eventTime: eventTime ?? event.eventTime,
      notes: notes !== undefined ? notes : event.notes,
    });

    res.json(mapSnowEvent(event));
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function deleteEvent(req, res) {
  try {
    const { eventId } = req.params;
    const event = await m.Event.findByPk(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (Number(event.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'You can only delete your own events' });
    }

    await event.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function getEvents(req, res) {
    try {
      const { user_id } = req.query; // Get user_id from query params
  
      const whereCondition = user_id ? { user_id } : {}; // If user_id exists, filter by it (API?user_id=12)
  
      const events = await m.Event.findAll({
        where: whereCondition, // Apply filter
        // include: [
        //   { model: m.User, attributes: ['id', 'name', 'image'], as: 'user' } // Include user data
        // ]
      });
  
      res.json(events);
    } catch (error) {
      res.status(500).json({ error });
    }
  }
  

async function getWhatsAppEvents(req, res) {
  try {
    const user = await m.User.findByPk(req.user.id, {
      attributes: ['id', 'whatsapp_jid', 'phone'],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const phone = (user.phone || '').trim();
    if (!phone && !user.whatsapp_jid) {
      return res.status(400).json({
        error: 'WhatsApp not linked',
        message: 'Add your phone number in Settings to load events from WhatsApp.',
      });
    }

    const jid = await resolveUserJid(user);
    if (!jid) {
      return res.status(400).json({
        error: 'WhatsApp not linked',
        message: 'We could not resolve your WhatsApp account from that phone number. Check Settings.',
      });
    }

    const limit = req.query.limit ? Number.parseInt(req.query.limit, 10) : undefined;

    const { events, groups } = await svc.chatbotEvents.fetchEventsForUser(jid, {
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      upcoming: true,
    });

    res.json({ events, groups });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Failed to fetch WhatsApp events' });
  }
}

async function getCalendar(req, res) {
  try {
    const user = await m.User.findByPk(req.user.id, {
      attributes: ['id', 'whatsapp_jid', 'phone'],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snowRows = await m.Event.findAll({
      where: { user_id: req.user.id },
      order: [['date', 'ASC']],
    });

    const snowEvents = snowRows
      .map(mapSnowEvent)
      .filter((ev) => new Date(ev.date) >= today);

    let whatsappEvents = [];
    let groups = [];
    let needsWhatsAppLink = false;
    let whatsappLinked = false;
    let whatsappError = null;

    const phone = (user.phone || '').trim();
    const hasContact = Boolean(phone || user.whatsapp_jid);

    if (!hasContact) {
      needsWhatsAppLink = true;
    } else {
      try {
        const jid = await resolveUserJid(user);
        if (jid) {
          whatsappLinked = true;
          const result = await svc.chatbotEvents.fetchEventsForUser(jid, { upcoming: true });
          whatsappEvents = result.events;
          groups = result.groups || [];
        } else {
          needsWhatsAppLink = true;
        }
      } catch (error) {
        whatsappError = error.message || 'Failed to fetch WhatsApp events';
      }
    }

    const merged = [...snowEvents, ...whatsappEvents].sort((a, b) => {
      const aDate = new Date(a.eventDatetime || a.date).getTime();
      const bDate = new Date(b.eventDatetime || b.date).getTime();
      return aDate - bDate;
    });

    const limit = req.query.limit ? Number.parseInt(req.query.limit, 10) : undefined;
    const events = Number.isFinite(limit) && limit > 0
      ? merged.slice(0, limit)
      : merged;

    res.json({
      events,
      groups,
      needsWhatsAppLink,
      whatsappLinked,
      whatsappError,
      snowCount: snowEvents.length,
      whatsappCount: whatsappEvents.length,
      bot: getWhatsAppBotConfig(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function getEventById(req, res) {
  try {
    const { eventId } = req.params;
    const event = await m.Event.findByPk(eventId);

    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (error) {
    res.status(500).json({ error });
  }
}

module.exports = {
  createEvent, updateEvent, deleteEvent, getEvents, getWhatsAppEvents, getCalendar, getEventById,
};