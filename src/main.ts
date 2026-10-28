
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import {
  ValidationPipe,
} from '@nestjs/common';

import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { createSessionMiddleware } from './config/session.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);

  const expressApp =
    app.getHttpAdapter().getInstance();

  // Solo si hay un proxy Nginx confiable.
  if (config.get('NODE_ENV') === 'production') {
    expressApp.set('trust proxy', 1);
  }

  const sessions =
    await createSessionMiddleware();

  app.use(sessions.middleware);

  app.enableCors({
    origin: [
      config.get('APP_URL') ?? 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Flow Manager API')
    .setDescription(
      'API de gestión de workflows mediante BFF y sesiones OIDC',
    )
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(
    app,
    swaggerConfig,
  );

  SwaggerModule.setup(
    'api/docs',
    app,
    document,
  );

  app.enableShutdownHooks();

  const port = Number(
    config.get('PORT') ?? 3000,
  );

  await app.listen(port);

  console.log(
    `Flow Manager API: http://localhost:${port}/api`,
  );

  console.log(`Swagger: http://localhost:${port}/api/docs`)

}

void bootstrap();
