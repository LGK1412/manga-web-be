import { NestFactory } from '@nestjs/core';
import { join } from "path";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);


  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); //Cua Cuong big
  app.use(cookieParser())
  app.use(bodyParser.json({ limit: '2.5mb' }));
  app.use(bodyParser.urlencoded({ limit: '2.5mb', extended: true }));
  app.enableCors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  });
  //  expose public folder
  app.useStaticAssets(join(process.cwd(), "public", "assets"), {
    prefix: "/assets",
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
