import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { registerSchema, loginSchema } from '../lib/validate.js';
import { asyncHandler, conflict, unauthorized } from '../lib/errors.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const existing = await User.findOne({ email: data.email });
    if (existing) throw conflict('An account with that email already exists. Try signing in.');
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({ name: data.name, email: data.email, passwordHash });
    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email });
    // Same message for unknown email and wrong password so we don't leak which emails exist.
    const ok = user && (await bcrypt.compare(data.password, user.passwordHash));
    if (!ok) throw unauthorized('Incorrect email or password.');
    res.json({ token: signToken(user), user: user.toPublic() });
  }),
);

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

export default router;
