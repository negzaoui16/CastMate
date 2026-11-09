import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

let cachedApp: any;

async function createApp() {
  if (cachedApp) {
    return cachedApp;
  }

  const app = await NestFactory.create(AppModule);

  // Configuration Swagger
  const config = new DocumentBuilder()
    .setTitle('CastMate API')
    .setDescription('API REST complète pour l\'application de castings mobile. Gestion séparée des acteurs et des agences (recruteurs), avec gestion complète des castings et candidatures.')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Entrez votre token JWT obtenu lors de la connexion',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentification', 'Endpoints pour la connexion')
    .addTag('Acteurs', 'Gestion des acteurs (inscription, profil, mise à jour)')
    .addTag('Agences', 'Gestion des agences de casting (inscription, profil, mise à jour)')
    .addTag('Castings', 'Gestion des castings et candidatures')
    .build();

  const document = SwaggerModule.createDocument(app as any, config);
  
  // Configuration Swagger avec options pour Vercel/serverless
  SwaggerModule.setup('api', app as any, document, {
    swaggerOptions: {
      persistAuthorization: true,
      // Options supplémentaires pour Vercel
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
    // Important: Custom CSS pour éviter les problèmes de chargement sur Vercel
    customCss: `
      .swagger-ui .topbar { display: none }
    `,
    // Custom site title
    customSiteTitle: 'CastMate API Documentation',
  });

  // Middleware de logging des requêtes
  app.use((req: any, res: any, next: any) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Configuration CORS
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validation globale des DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  
  // Get Express instance from NestJS adapter
  const expressApp = app.getHttpAdapter().getInstance();
  cachedApp = expressApp;
  return expressApp;
}

export default async function handler(req: any, res: any) {
  const app = await createApp();
  return app(req, res);
}
