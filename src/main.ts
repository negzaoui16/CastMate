import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuration Swagger
  const config = new DocumentBuilder()
    .setTitle('CastMate API')
    .setDescription(
      'API REST complète pour l\'application de castings mobile. Gestion séparée des acteurs et des agences (recruteurs), avec gestion des castings, candidatures et stockage sécurisé des médias utilisateurs (images, PDF) via GridFS.',
    )
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
    .addTag('Media', 'Streaming sécurisé des fichiers stockés dans GridFS')
    .addTag('Training', 'Gestion des entraînements et récompenses NFT')
    .build();

  const document = SwaggerModule.createDocument(app as any, config);
  SwaggerModule.setup('api', app as any, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Middleware de logging des requêtes
  app.use((req: any, res: any, next: any) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Configuration CORS pour l'application mobile Flutter
  app.enableCors({
    origin: true, // En production, spécifiez les origines autorisées
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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Application démarrée sur le port ${port}`);
  console.log(`📚 Documentation Swagger: http://localhost:${port}/api`);
}
bootstrap();
