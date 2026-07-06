const LocalStrategy = require('passport-local').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt;
const JWTstrategy = require('passport-jwt').Strategy;
const passport = require('passport');
const bcrypt = require('bcrypt');
const moment = require('moment');
// load user model
const UserModel = require('./models').User;

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

const normalizeUsername = (value) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

// Signup passport
passport.use('signup', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password',
  passReqToCallback: true,
}, async (req, uname, pass, done) => {
  try {
    const {
      name, email, password, phone, username,
    } = req.body;
    const normalizedUsername = normalizeUsername(username);

    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      return done(null, false, {
        message: 'Username must be 3–30 characters: lowercase letters, numbers, underscore',
      });
    }

    const existingEmail = await UserModel.findOne({ where: { email } });
    if (existingEmail) {
      return done(null, false, { message: 'That email is already taken' });
    }

    const existingUsername = await UserModel.findOne({
      where: { username: normalizedUsername },
    });
    if (existingUsername) {
      return done(null, false, { message: 'That username is already taken' });
    }

    const hashpass = bcrypt.hashSync(password, bcrypt.genSaltSync());
    const newUser = await UserModel.create({
      name,
      email,
      password: hashpass,
      phone,
      username: normalizedUsername,
    });

    return done(null, newUser);
  } catch (error) {
    return done(error);
  }
}));

// Login passport
passport.use('login', new LocalStrategy({ usernameField: 'email', passwordField: 'password' },
  async (email, password, done) => {
    try {
      const user = await UserModel.findOne({ where: { email } });
      if (!user) return done(null, false, { message: 'User not found' });

      const validate = await bcrypt.compare(password, user.password);
      if (!validate) return done(null, false, { message: 'Wrong Password' });

      if (!user.verifiedAt) {
        return done(null, false, {
          message: 'Please verify your email before logging in. Check your inbox for the link.',
        });
      }

      return done(null, user, { message: 'Logged in Successfully' });
    } catch (error) {
      return done(error, false, { message: error.message });
    }
  }));

// JWT passport
passport.use('jwt', new JWTstrategy({
  jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.PROJECT_JWT_SECRET,
}, async (jwt_payload, done) => {
  const user = await UserModel.findOne({ where: { id: jwt_payload.uid } });
  if (user) {
    return done(null, user);
  }
  return done(null, false);
}));

passport.use('forgotpasswordjwt', new JWTstrategy({
  jwtFromRequest: ExtractJWT.fromBodyField('resetToken'),
  secretOrKey: process.env.PROJECT_JWT_SECRET,
}, async (jwt_payload, done) => {
  try {
    const userId = String(jwt_payload.uid);
    const user = await UserModel.findOne({ where: { id: userId } });

    if (!user) return done(null, false);

    if (moment().unix() > jwt_payload.exp) return done(null, false);

    return done(null, user);
  } catch (error) {
    return done(error, false);
  }
}));
