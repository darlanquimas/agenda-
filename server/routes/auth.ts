import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import config from '../config';
import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { markPublic } from '../middleware/publicRoute';
import { USER_SELECT, rowToAuthUser } from '../middleware/auth';
import { serializeUser } from '../lib/userSerializer';

const router = createRouter();

router.post('/login', ...markPublic(async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

  const row = await prisma.user.findUnique({ where: { email } });
  if (!row || !row.active || !bcrypt.compareSync(password, row.password)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const userRow = await prisma.user.findUnique({ where: { id: row.id }, select: USER_SELECT });
  const user = serializeUser(rowToAuthUser(userRow!));
  const opts: SignOptions = { expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] };
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, opts);
  res.json({ token, user });
}));

router.get('/me', (req, res) => {
  res.json(serializeUser(req.user));
});

export default router;
