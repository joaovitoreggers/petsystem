import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  // Em produção, o segredo padrão deixaria qualquer um forjar tokens de
  // login. Não derrubamos o processo (o docker-compose local também roda com
  // NODE_ENV=production e o padrão), mas o aviso fica bem visível no log.
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')
  ) {
    Logger.warn(
      'JWT_SECRET ausente ou igual ao padrão "dev-secret": defina um segredo forte antes de expor este ambiente.',
    );
  }
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
