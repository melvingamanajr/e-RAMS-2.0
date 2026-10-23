import 'reflect-metadata';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Module } from '@nestjs/common';
import { NestFactory, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import express, { type Response } from 'express';
import { config } from './config';
import { Db } from './db';
import { AuthGuard } from './auth';
import { Limits } from './limits';
import { Live } from './live';
import { Attendance } from './attendance';
import { Biometrics } from './biometrics';
import { AuthController, AttendanceController, ManagementController } from './controllers';
@Catch()
class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) return res.status(error.getStatus()).json(error.getResponse());
    if (error && typeof error === 'object' && 'status' in error && [400, 413].includes(Number(error.status))) return res.status(Number(error.status)).json({ message: Number(error.status) === 413 ? 'Request body is too large' : 'Invalid JSON body' });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const status = error.code === 'P2002' ? 409 : error.code === 'P2025' ? 404 : error.code === 'P2003' ? 400 : 500;
      return res.status(status).json({ message: status === 409 ? 'A record with these details already exists' : status === 404 ? 'Record not found' : status === 400 ? 'The referenced record does not exist' : 'Database operation failed' });
    }
    console.error(error instanceof Error ? error.message : 'Unexpected error');
    return res.status(500).json({ message: 'An unexpected error occurred' });
  }
}
@Module({ imports: [JwtModule.register({})], controllers: [AuthController, AttendanceController, ManagementController], providers: [Db, Limits, Live, Attendance, Biometrics, { provide: APP_GUARD, useClass: AuthGuard }] })
class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  if (config.TRUST_PROXY === 'true') app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '3mb' }));
  app.use(cookieParser());
  app.use((_req: any, res: Response, next: () => void) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.enableCors({ origin: config.WEB_ORIGIN, credentials: true });
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
  app.get(Live).attach(app.getHttpServer());
  await app.listen(config.PORT, '0.0.0.0');
  console.log(`e-RAMS API listening on port ${config.PORT}`);
}
void bootstrap().catch(error => { console.error(error.message); process.exit(1); });
