import { Request, Response, NextFunction } from 'express';

export default function forbidProfessional(req: Request, res: Response, next: NextFunction) {
  if (req.user.role === 'professional') {
    return res.status(403).json({ error: 'Acesso não permitido para este perfil' });
  }
  next();
}
