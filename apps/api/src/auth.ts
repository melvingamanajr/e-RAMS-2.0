import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { Db } from './db';
import { config } from './config';
import { tokenHash } from './crypto';
export interface Actor { id: string; name: string; role: Role | 'KIOSK'; sessionId?: string; }
export interface AuthRequest extends Request { actor: Actor; }
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: (Role | 'KIOSK')[]) => SetMetadata('roles', roles);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly db: Db, private readonly jwt: JwtService, private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    // Cookie authentication uses an exact allowed Origin for every mutation (CSRF protection).
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== config.WEB_ORIGIN) throw new ForbiddenException('Untrusted origin');
    if (this.reflector.getAllAndOverride<boolean>('public', [ctx.getHandler(), ctx.getClass()])) return true;
    const authorization = req.headers.authorization;
    if (authorization?.startsWith('Kiosk ')) {
      const kiosk = await this.db.kiosk.findUnique({ where: { tokenHash: tokenHash(authorization.slice(6)) } });
      if (!kiosk?.active) throw new UnauthorizedException('Kiosk credential is invalid or revoked');
      req.actor = { id: kiosk.id, name: kiosk.name, role: 'KIOSK' };
    } else {
      const token = req.cookies?.erams_session;
      try {
        const claims = await this.jwt.verifyAsync(token, { secret: config.JWT_SECRET });
        const user = await this.db.user.findUnique({ where: { id: claims.sub } });
        const session = typeof claims.sid === 'string' ? await this.db.session.findUnique({ where: { id: claims.sid } }) : null;
        if (!user?.active || !session || session.userId !== user.id || session.revokedAt || +session.expiresAt < Date.now()) throw new Error('Inactive session');
        req.actor = { id: user.id, name: user.name, role: user.role, sessionId: session.id };
      } catch { throw new UnauthorizedException('Please sign in to continue'); }
    }
    const roles = this.reflector.getAllAndOverride<(Role | 'KIOSK')[]>('roles', [ctx.getHandler(), ctx.getClass()]) ?? ['ADMIN', 'HR', 'AUDITOR'];
    if (!roles.includes(req.actor.role)) throw new ForbiddenException('Your role does not allow this action');
    return true;
  }
}
