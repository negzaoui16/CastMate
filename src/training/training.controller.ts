import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
  Res,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { TrainingService } from './training.service';
import { RankingService } from './ranking.service';
import { SubmitTrainingDto } from './dto/submit-training.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { Role } from '../common/enums/role.enum';
import { Public } from '../common/decorators/public.decorator';
import { ActeurService } from '../acteur/acteur.service';

@ApiTags('Training')
@Controller('training')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TrainingController {
  constructor(
    private readonly trainingService: TrainingService,
    private readonly rankingService: RankingService,
    private readonly acteurService: ActeurService,
  ) {}

  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Soumet une session d\'entraînement',
    description:
      'Enregistre les résultats d\'une session d\'entraînement. Si le score global >= 70, un NFT est automatiquement créé sur Hedera Network.',
  })
  @ApiBody({ type: SubmitTrainingDto })
  @ApiResponse({
    status: 201,
    description: 'Session d\'entraînement enregistrée avec succès',
    schema: {
      example: {
        session: {
          id: '507f1f77bcf86cd799439011',
          acteurId: '507f1f77bcf86cd799439012',
          niveau: 1,
          globalScore: 88,
          emotions: {
            detected: ['joie', 'enthousiasme'],
            coherence: 90,
            intensity: 85,
          },
          strengths: ['Excellent contact visuel'],
          recommendations: ['Amplifier les émotions'],
          nftRewarded: true,
          completedAt: '2024-01-15T10:30:00.000Z',
        },
        nftReward: {
          id: '507f1f77bcf86cd799439013',
          tokenId: '0.0.1234567',
          serialNumber: '1',
          transactionId: '0.0.1234567@1234567890.123456789',
          imageUrl: 'http://localhost:3000/training/nft-images/1.png',
          status: 'MINTED',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  @ApiResponse({
    status: 404,
    description: 'Acteur non trouvé',
  })
  async submitTraining(
    @Body() submitTrainingDto: SubmitTrainingDto,
    @CurrentUser() currentUser: any,
  ) {
    // Vérifier que l'utilisateur soumet pour lui-même (ou est admin)
    const currentUserId = String(currentUser.id || currentUser._id);
    if (
      currentUser.role !== Role.ADMIN &&
      currentUserId !== submitTrainingDto.acteurId
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez soumettre que vos propres sessions d\'entraînement',
      );
    }

    return this.trainingService.submitTraining(submitTrainingDto);
  }

  @Get('actor/:acteurId/sessions')
  @ApiOperation({
    summary: 'Récupère toutes les sessions d\'entraînement d\'un acteur',
  })
  @ApiParam({
    name: 'acteurId',
    description: "ID de l'acteur",
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des sessions d\'entraînement',
  })
  async getActorSessions(
    @Param('acteurId', ParseObjectIdPipe) acteurId: string,
    @CurrentUser() currentUser: any,
  ) {
    const currentUserId = String(currentUser.id || currentUser._id);
    if (currentUser.role !== Role.ADMIN && currentUserId !== acteurId) {
      throw new ForbiddenException(
        'Vous ne pouvez consulter que vos propres sessions',
      );
    }

    return this.trainingService.getActorTrainingSessions(acteurId);
  }

  @Get('actor/:acteurId/nfts')
  @ApiOperation({
    summary: 'Récupère tous les NFTs d\'un acteur',
  })
  @ApiParam({
    name: 'acteurId',
    description: "ID de l'acteur",
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des NFTs',
  })
  async getActorNFTs(
    @Param('acteurId', ParseObjectIdPipe) acteurId: string,
    @CurrentUser() currentUser: any,
  ) {
    const currentUserId = String(currentUser.id || currentUser._id);
    if (currentUser.role !== Role.ADMIN && currentUserId !== acteurId) {
      throw new ForbiddenException(
        'Vous ne pouvez consulter que vos propres NFTs',
      );
    }

    return this.trainingService.getActorNFTs(acteurId);
  }

  @Get('session/:sessionId')
  @ApiOperation({
    summary: 'Récupère une session d\'entraînement par ID',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID de la session d\'entraînement',
  })
  @ApiResponse({
    status: 200,
    description: 'Session d\'entraînement',
  })
  @ApiResponse({
    status: 404,
    description: 'Session non trouvée',
  })
  async getSession(
    @Param('sessionId', ParseObjectIdPipe) sessionId: string,
    @CurrentUser() currentUser: any,
  ) {
    const session = await this.trainingService.getTrainingSession(sessionId);

    const currentUserId = String(currentUser.id || currentUser._id);
    const sessionActeurId = String(session.acteurId);

    if (currentUser.role !== Role.ADMIN && currentUserId !== sessionActeurId) {
      throw new ForbiddenException(
        'Vous ne pouvez consulter que vos propres sessions',
      );
    }

    return session;
  }

  @Post('nft/:nftId/transfer')
  @ApiOperation({
    summary: 'Initie le transfert d\'un NFT vers le wallet HashPack de l\'acteur',
    description:
      'Crée une transaction de transfert que l\'acteur doit signer avec HashPack',
  })
  @ApiParam({
    name: 'nftId',
    description: 'ID du NFT (MongoDB ObjectId)',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction de transfert créée',
    schema: {
      example: {
        transactionData: {
          tokenId: '0.0.1234567',
          serialNumber: '1',
          recipientAccountId: '0.0.7654321',
        },
        message: 'Utilisez cette transaction dans HashPack pour signer et transférer le NFT',
      },
    },
  })
  async initiateNFTTransfer(
    @Param('nftId', ParseObjectIdPipe) nftId: string,
    @CurrentUser() currentUser: any,
  ) {
    const currentUserId = String(currentUser.id || currentUser._id);

    // Récupérer le NFT
    const nftReward = await this.trainingService.getNFTReward(nftId);

    if (String(nftReward.acteurId) !== currentUserId) {
      throw new ForbiddenException(
        'Vous ne pouvez transférer que vos propres NFTs',
      );
    }

    // Récupérer l'acteur pour obtenir son adresse HashPack
    const acteur = await this.acteurService.findById(currentUserId);
    if (!acteur?.hashpackAccountId) {
      throw new BadRequestException(
        'Vous devez d\'abord enregistrer votre adresse HashPack',
      );
    }

    // Retourner les données de la transaction
    // Le frontend utilisera ces données pour créer la transaction dans HashPack
    return {
      transactionData: {
        tokenId: nftReward.tokenId,
        serialNumber: nftReward.serialNumber,
        recipientAccountId: acteur.hashpackAccountId,
        treasuryAccountId: process.env.HEDERA_ACCOUNT_ID, // Compte qui détient actuellement le NFT
      },
      message:
        'Utilisez ces données dans HashPack pour créer et signer la transaction de transfert',
    };
  }

  @Public()
  @Get('nft-images/:niveau.png')
  @ApiOperation({
    summary: 'Récupère l\'image NFT pour un niveau donné',
    description: 'Sert l\'image PNG de la carte NFT pour le niveau spécifié',
  })
  @ApiParam({
    name: 'niveau',
    description: 'Numéro du niveau (1, 2, 3, ...)',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Image NFT',
    content: {
      'image/png': {},
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Image NFT non trouvée pour ce niveau',
  })
  async getNFTImage(@Param('niveau') niveau: string, @Res() res: Response) {
    try {
      const niveauNum = parseInt(niveau, 10);
      if (isNaN(niveauNum) || niveauNum < 1) {
        throw new NotFoundException('Niveau invalide');
      }

      const imagePath = join(process.cwd(), 'public', 'nft-images', `${niveauNum}.png`);
      const imageBuffer = readFileSync(imagePath);

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', imageBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache 1 an
      res.send(imageBuffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Image NFT non trouvée pour le niveau ${niveau}`);
    }
  }

  @Public()
  @Get('nft-metadata/:tokenId/:serialNumber')
  @ApiOperation({
    summary: 'Récupère les métadonnées complètes d\'un NFT au format standard',
    description:
      'Retourne les métadonnées complètes du NFT au format ERC-721 compatible pour les wallets (HashPack, etc.)',
  })
  @ApiParam({
    name: 'tokenId',
    description: 'Token ID du NFT sur Hedera (ex: 0.0.7360902)',
    type: String,
  })
  @ApiParam({
    name: 'serialNumber',
    description: 'Numéro de série du NFT (ex: 1)',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Métadonnées NFT au format standard',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        image: { type: 'string' },
        attributes: { type: 'array' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'NFT non trouvé',
  })
  async getNFTMetadata(
    @Param('tokenId') tokenId: string,
    @Param('serialNumber') serialNumber: string,
  ) {
    return await this.trainingService.getNFTMetadata(tokenId, serialNumber);
  }

  @Get('leaderboard')
  @ApiOperation({
    summary: 'Récupère le classement global des acteurs',
    description:
      'Retourne le leaderboard trié par score global décroissant avec pagination',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de page (défaut: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de résultats par page (défaut: 50, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Classement global des acteurs',
    schema: {
      example: {
        actors: [
          {
            acteurId: '507f1f77bcf86cd799439011',
            nom: 'Doe',
            prenom: 'John',
            ranking: {
              globalScore: 5234,
              rank: 'FAMOUS',
              averageScore: 87.5,
              totalSessions: 25,
              totalNFTs: 20,
              maxLevel: 5,
              consistency: 85.2,
              recentPerformance: 90.0,
              winStreak: 5,
              globalPosition: 1,
              percentile: 99,
              lastUpdated: '2024-01-15T10:30:00.000Z',
            },
          },
        ],
        total: 150,
        page: 1,
        limit: 50,
        totalPages: 3,
      },
    },
  })
  async getLeaderboard(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException('Page doit être un nombre positif');
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException(
        'Limit doit être un nombre entre 1 et 100',
      );
    }

    return this.rankingService.getLeaderboard(pageNum, limitNum);
  }

  @Get('ranking/:acteurId')
  @ApiOperation({
    summary: 'Récupère le classement d\'un acteur spécifique',
    description:
      'Retourne toutes les statistiques de classement pour un acteur donné',
  })
  @ApiParam({
    name: 'acteurId',
    description: "ID de l'acteur",
  })
  @ApiResponse({
    status: 200,
    description: 'Classement de l\'acteur',
    schema: {
      example: {
        globalScore: 5234,
        rank: 'FAMOUS',
        averageScore: 87.5,
        totalSessions: 25,
        totalNFTs: 20,
        maxLevel: 5,
        consistency: 85.2,
        recentPerformance: 90.0,
        winStreak: 5,
        globalPosition: 1,
        percentile: 99,
        lastUpdated: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Acteur non trouvé',
  })
  async getActorRanking(
    @Param('acteurId', ParseObjectIdPipe) acteurId: string,
  ) {
    return this.rankingService.getActorRanking(acteurId);
  }
}

