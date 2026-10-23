import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Db } from './db';
import { config } from './config';
@Injectable()
export class Live implements OnModuleDestroy {
  private io?: Server;
  constructor(private readonly db: Db, private readonly jwt: JwtService) {}
  attach(server: any) {
    this.io = new Server(server, { cors: { origin: config.WEB_ORIGIN, credentials: true }, maxHttpBufferSize: 2048 });
    this.io.use(async (socket, next) => {
      try {
        const cookie = (socket.handshake.headers.cookie ?? '').split(';').map(c => c.trim()).find(c => c.startsWith('erams_session='))?.slice(14);
        const claims = await this.jwt.verifyAsync(cookie ?? '', { secret: config.JWT_SECRET });
        const user = await this.db.user.findUnique({ where: { id: claims.sub } });
        const session = typeof claims.sid === 'string' ? await this.db.session.findUnique({ where: { id: claims.sid } }) : null;
        if (!user?.active || !session || session.userId !== user.id || session.revokedAt || +session.expiresAt < Date.now()) throw new Error('Inactive session');
        socket.data.userId = user.id;
        socket.data.expiresAt = claims.exp * 1000;
        next();
      } catch { next(new Error('Authentication required')); }
    });
  }
  async changed() {
    // Emit an invalidation only; clients re-fetch through HTTP authorization.
    for (const socket of this.io?.sockets.sockets.values() ?? []) {
      if (Date.now() >= socket.data.expiresAt) socket.disconnect(true);
      else socket.emit('attendance:changed');
    }
  }
  disconnectUser(userId: string) { for (const socket of this.io?.sockets.sockets.values() ?? []) if (socket.data.userId === userId) socket.disconnect(true); }
  async onModuleDestroy() { await this.io?.close(); }
}
