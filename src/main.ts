import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const originsRaw = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
  const origin =
    originsRaw.trim() === '*'
      ? true
      : originsRaw
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);

  app.enableCors({ origin, credentials: true });
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.PORT ?? 4000);
  // Bind all interfaces so Heroku / containers / LAN devices can reach the API.
  await app.listen(port, '0.0.0.0');
  console.log(`Horse VPN API listening on http://0.0.0.0:${port}/v1`);
}
bootstrap();
