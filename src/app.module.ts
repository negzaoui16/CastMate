import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ActeurModule } from './acteur/acteur.module';
import { AgenceModule } from './agence/agence.module';
import { CastingsModule } from './castings/castings.module';
import { MediaModule } from './media/media.module';
import { TrainingModule } from './training/training.module';
import { InterviewsModule } from './interviews/interviews.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        
        if (!uri) {
          throw new Error('MONGODB_URI is not defined in environment variables');
        }

        return {
          uri,
          // Connection options for serverless environments (Vercel)
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          connectTimeoutMS: 10000,
          // Retry options
          retryWrites: true,
          w: 'majority',
          // Pool options for serverless
          maxPoolSize: 10,
          minPoolSize: 1,
          // Note: SSL/TLS is automatically enabled for mongodb+srv:// URIs MBF
        };
      },
      inject: [ConfigService],
    }),
    CastingsModule,
    MediaModule,
    TrainingModule,
    AuthModule,
    ActeurModule,
    AgenceModule,
    InterviewsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
