const bcrypt = require('bcrypt');
const m = require('../models');
const svc = require('../services');
const { normalizeWhatsAppJid, isPhoneInput } = require('../helper/whatsapp');

async function update(req, res) {
  const {
    new_password, old_password,
  } = req.body;

  const fields = {};
  const fileds_that_allowed_to_be_update_directly = ['name'];
  fileds_that_allowed_to_be_update_directly.forEach(f => {
    if (req.body[f]) {
      fields[f] = req.body[f];
    }
  });

  if (req.body.bio !== undefined) {
    if (Number(req.params.UserId) !== Number(req.user.id)) {
      res.status(403).send({ error: 'You can only change your own bio' });
      return;
    }
    fields.bio = String(req.body.bio).trim();
  }

  if (req.body.is_private !== undefined) {
    if (Number(req.params.UserId) !== Number(req.user.id)) {
      res.status(403).send({ error: 'You can only change your own privacy settings' });
      return;
    }
    fields.is_private = Boolean(req.body.is_private);
  }

  if (req.body.phone !== undefined) {
    if (Number(req.params.UserId) !== Number(req.user.id)) {
      res.status(403).send({ error: 'You can only change your own phone number' });
      return;
    }

    fields.phone = req.body.phone;

    if (isPhoneInput(req.body.phone)) {
      const resolved = await svc.chatbotEvents.resolveJidFromPhone(req.body.phone);
      if (!resolved.jid) {
        res.status(400).json({
          error: resolved.error || 'Could not resolve WhatsApp account from this phone number',
        });
        return;
      }
      fields.whatsapp_jid = resolved.jid;
    }
  }

  if (req.body.whatsapp_jid !== undefined) {
    if (Number(req.params.UserId) !== Number(req.user.id)) {
      res.status(403).send({ error: 'You can only change your own WhatsApp JID' });
      return;
    }

    const rawJid = String(req.body.whatsapp_jid).trim();

    if (isPhoneInput(rawJid)) {
      const resolved = await svc.chatbotEvents.resolveJidFromPhone(rawJid);
      if (!resolved.jid) {
        res.status(400).json({
          error: resolved.error || 'Could not resolve WhatsApp account from this phone number',
        });
        return;
      }
      fields.whatsapp_jid = resolved.jid;
    } else {
      fields.whatsapp_jid = normalizeWhatsAppJid(rawJid);
    }
  }

  if (new_password && old_password) {
    const user = await m.User.findOne({ where: { id: req.params.UserId } });
    if (!bcrypt.compare(old_password, user.password)) {
      res.status(422).send({ error: 'Wrong old password' });
      return;
    }
    fields.password = bcrypt.hashSync(new_password, bcrypt.genSaltSync());
  }

  try {
    await m.User.update(fields, { where: { id: req.params.UserId } });
    res.json({
      status: 'updated',
      whatsapp_jid: fields.whatsapp_jid,
    });
  } catch (error) {
    res.status(500).send({ error });
  }
}

module.exports = {
  update,
};
