const { includes } = require('lodash');
const m = require('../models');

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
        eventTime,
        notes });
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ error });
  }
}

async function updateEvent(req, res) {
  try {
    const { eventId } = req.params;
    const { eventTitle, date, eventTime, notes } = req.body;
    const updated = await m.Event.update(
      { eventTitle, date, eventTime, notes },
      { where: { id: eventId } }
    );

    if (updated[0] === 0) return res.status(404).json({ message: 'Event not found' });
    res.json({ message: 'Event updated' });
  } catch (error) {
    res.status(500).json({ error });
  }
}

async function deleteEvent(req, res) {
  try {
    const { eventId } = req.params;
    const deleted = await m.Event.destroy({ where: { id: eventId } });

    if (!deleted) return res.status(404).json({ message: 'Event not found' });
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ error });
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

module.exports = { createEvent, updateEvent, deleteEvent, getEvents, getEventById };