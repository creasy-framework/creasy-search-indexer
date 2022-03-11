import { NestFactory } from '@nestjs/core';
import { AppModule } from './AppModule';
import { AppExceptionFilter } from './AppExceptionFilter';

const port = process.env.APP_PORT || 3001;

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AppExceptionFilter());
  await app.listen(port);
};
bootstrap();
