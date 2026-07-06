const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const randtoken = require('rand-token');
const svc = require('../services');
const m = require('../models');

const refreshTokens = {};

function login(req, res, next) {
  passport.authenticate('login', async (err, user, info) => {
    try {
      if (err || !user) {
        res.status(401).json({ error: 'fail to authenticate user', details: info.message });
        return;
      }
      req.login(user, { session: false }, async (error) => {
        if (error) next(error);
        if (user.reset_token) user.update({ reset_token: null });
        const jwt_content = { uid: user.id, email: user.email, role: 'admin' };
        // Sign the JWT token and populate the payload with the user email and id
        // Send back the token to the user
        const token = jwt.sign(jwt_content, process.env.PROJECT_JWT_SECRET, { expiresIn: 86400 });
        const refreshToken = randtoken.uid(256);
        const userId = user.id;
        refreshTokens[refreshToken] = user.email;
        res.json({ token, refreshToken, userId });
      });
    } catch (error) {
      next(error);
    }
  })(req, res, next);
}

// function signup(req, res, next) {
//   passport.authenticate('signup', { session: false }, async (err, user, info) => {
//     try {
//       if (err || !user) res.status(401).json({ error: 'fail to register user', message: info.message });
//       res.status(201).json({ user });
//     } catch (error) {
//       next(error);
//     }
//   })(req, res, next);
// }

function signup(req, res, next) {
  passport.authenticate('signup', { session: false }, async (err, user, info) => {
    try {
      if (err || !user) {
        res.status(401).json({
          error: 'fail to register user',
          message: info?.message || 'Registration failed',
        });
        return;
      }

      const verificationToken = jwt.sign(
        { uid: user.id, email: user.email },
        process.env.PROJECT_JWT_SECRET,
        { expiresIn: '24h' },
      );

      const baseUrl = (req.body.redirect_url || process.env.APP_URL || 'http://localhost:3000')
        .replace(/\/$/, '');
      const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

      try {
        await svc.verifyMail(user, verificationUrl);
        res.status(201).json({ user, message: 'Verification email sent!' });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError.message);
        res.status(201).json({
          user,
          message: 'Account created, but the verification email could not be sent. Check MAIL_* settings in .env.',
          emailSent: false,
        });
      }
    } catch (error) {
      next(error);
    }
  })(req, res, next);
}

async function verifyEmail(req, res) {
  const { token } = req.query;

  try {
    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.PROJECT_JWT_SECRET);
    const user = await m.User.findOne({ where: { id: decoded.uid } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user to mark them as verified
    await user.update({ verifiedAt: new Date() });

    res.json({ message: 'Email successfully verified!' });
  } catch (error) {
    res.status(400).json({ error: 'Invalid or expired token' });
  }
}

// async function requestPasswordReset(req, res, next) {
//   const { email } = req.body;

//   try {
//     // Find the user by email
//     const user = await m.User.findOne({ where: { email } });

//     if (!user) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     // Call the email service to send the reset email
//     await svc.sendMailForgotPassword(user);

//     res.json({ message: 'Password reset email sent!' });
//   } catch (error) {
//     next(error);
//   }
// }


async function requestPasswordReset(req, res, next) {
  const { email } = req.body;

  try {
    // Find the user by email
    const user = await m.User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate a reset token
    const resetToken = randtoken.uid(255);
    console.log('Generated resetToken:', resetToken);

    // Save the reset token in the user record (you can also add an expiry date if needed)
    const updateResult = await user.update({ reset_token: resetToken });
    console.log('Update result:', updateResult);

    // Call the email service to send the reset email, including the reset token
    await svc.sendMailForgotPassword(user, resetToken);

    res.json({ message: 'Password reset email sent!' });
  } catch (error) {
    console.error('Error in requestPasswordReset:', error);
    next(error);
  }
}

function passwordResetTokenValidation(req, res, next) {
  console.log('Incoming resetToken:', req.body.resetToken);
  passport.authenticate('forgotpasswordjwt', async (err, user) => {
    try {
      if (err || !user) {
        console.log('Authentication error or user not found:', err);
        return res.status(404).json({ error: err || 'User not found' });
      }

      if (!user.reset_token) {
        console.log('No reset_token found for user:', user);
        return res.status(422).json({ error: 'Token is invalid' });
      }

      if (user.reset_token !== req.body.resetToken) {
        console.log('Token mismatch:', user.reset_token, req.body.resetToken);
        return res.status(422).json({ error: 'Token is invalid' });
      }

      req.user = user; // Attach user object to request
      return next();   // Proceed to the next middleware
    } catch (error) {
      console.error('Error in token validation:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  })(req, res, next);
}


async function passwordReset(req, res, next) {
  const { resetToken, newPassword } = req.body;

  console.log('Request Body:', req.body);

  try {
    if (!resetToken) {
      console.error('resetToken is undefined');
      return res.status(400).json({ error: 'resetToken is required' });
    }

    const user = await m.User.findOne({ where: { reset_token: resetToken } });
    
    if (!user) {
      console.log(`Invalid reset token: ${resetToken}`);
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    
    await user.save();
    console.log(`Password reset successful for user ID: ${user.id}`);

    // Log before sending response
    console.log('Sending response: Password reset successful');
    return res.json({ message: 'Password has been reset successfully!' });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    
    if (!res.headersSent) {
      console.log('Sending error response');
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}


module.exports = {
  login, signup, verifyEmail, requestPasswordReset, passwordResetTokenValidation, passwordReset,
};
