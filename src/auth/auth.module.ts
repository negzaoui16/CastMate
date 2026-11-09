import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ActeurModule } from '../acteur/acteur.module';
import { AgenceModule } from '../agence/agence.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PasswordResetToken, PasswordResetTokenSchema } from './schemas/password-reset-token.schema';
import { PasswordResetTokenService } from './password-reset-token.service';

@Module({
  imports: [
    ActeurModule,
    AgenceModule,
    PassportModule,
    MongooseModule.forFeature([
      { name: PasswordResetToken.name, schema: PasswordResetTokenSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PasswordResetTokenService],
  exports: [AuthService],
})
export class AuthModule {}
