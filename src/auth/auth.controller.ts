import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Connexion et obtention du token JWT',
    description: 'Authentifie un acteur ou une agence et retourne un token JWT pour les requêtes suivantes. Utilisez /acteur/signup ou /agence/signup pour vous inscrire.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: '507f1f77bcf86cd799439011',
          email: 'jean.dupont@example.com',
          nom: 'Dupont',
          prenom: 'Jean',
          role: 'ACTEUR',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Email ou mot de passe incorrect',
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Demander la réinitialisation de mot de passe',
    description: "Génère un token de reset valable 1h et retourne un lien de deep link pour l'app.",
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Token généré et email envoyé (ou token retourné)',
    schema: {
      example: {
        success: true,
        message: 'Reset email sent',
        token: 'abcdef1234...',
        link: 'castmate://reset-password?token=...&email=user@example.com&type=ACTEUR',
        expiresIn: 3600,
      },
    },
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Appliquer la réinitialisation du mot de passe',
    description: "Valide le token, met à jour le mot de passe hashé et invalide le token.",
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe mis à jour',
    schema: { example: { success: true, message: 'Password updated' } },
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}

