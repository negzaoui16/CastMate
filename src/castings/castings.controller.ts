import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CastingsService } from './castings.service';
import { CreateCastingDto } from './dto/create-casting.dto';
import { UpdateCastingDto } from './dto/update-casting.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import {
  IMAGE_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../media/media.constants';
import { ApplyToCastingDto } from './dto/apply-to-casting.dto';
import { extractValidationErrors } from '../common/utils/validation.util';
import { AcceptCandidateWithInterviewDto } from '../interviews/dto/accept-candidate-with-interview.dto';
import type { Express } from 'express';

const CASTING_POSTER_MIME_TYPES = new Set<string>(IMAGE_MIME_TYPES);

const castingPosterUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, callback) => {
    if (CASTING_POSTER_MIME_TYPES.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new BadRequestException(
          'Type de fichier non autorisé. Formats acceptés : JPEG, PNG.',
        ),
        false,
      );
    }
  },
};

const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
] as const;

const VIDEO_MIME_TYPES_SET = new Set<string>(VIDEO_MIME_TYPES);
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const auditionVideoUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_VIDEO_SIZE_BYTES,
  },
  fileFilter: (_req, file, callback) => {
    if (!file || VIDEO_MIME_TYPES_SET.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new BadRequestException(
          'Format vidéo non supporté. Formats acceptés : MP4, MPEG, MOV, AVI, WEBM.',
        ),
        false,
      );
    }
  },
};

const parsePayload = <T>(
  payload: string | undefined,
  body: unknown,
  errorMessage: string,
  allowEmpty = false,
): T => {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as T;
    } catch {
      throw new BadRequestException(errorMessage);
    }
  }

  if (
    body &&
    typeof body === 'object' &&
    Object.keys(body as Record<string, unknown>).length > 0
  ) {
    return body as T;
  }

  if (allowEmpty) {
    return {} as T;
  }

  throw new BadRequestException(errorMessage);
};

@ApiTags('Castings')
@Controller('castings')
export class CastingsController {
  constructor(private readonly castingsService: CastingsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Liste tous les castings',
    description: 'Récupère la liste de tous les castings disponibles (route publique)',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des castings retournée avec succès',
  })
  findAll() {
    return this.castingsService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Récupère un casting par son ID',
    description: 'Retourne les détails complets d\'un casting spécifique (route publique)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du casting (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Casting trouvé',
  })
  @ApiResponse({
    status: 404,
    description: 'Casting non trouvé',
  })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.castingsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECRUTEUR, Role.ADMIN)
  @UseInterceptors(FileInterceptor('affiche', castingPosterUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crée un nouveau casting',
    description: 'Permet à un recruteur ou un admin de créer un nouveau casting (affiche optionnelle).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['payload'],
      properties: {
        payload: {
          type: 'string',
          description:
            'Payload JSON contenant les informations du DTO `CreateCastingDto`.',
          example: JSON.stringify({
            titre: 'Recherche acteur principal',
            descriptionRole: 'Rôle principal masculin 30-40 ans',
            synopsis: 'Série dramatique...',
            lieu: 'Paris',
            dateDebut: '2024-01-15',
            dateFin: '2024-02-15',
            prix: 5000,
            types: ['Cinéma', 'Télévision'],
            age: '25-35 ans',
            ouvert: true,
            conditions: 'Disponibilité totale requise',
          }),
        },
        affiche: {
          type: 'string',
          format: 'binary',
          description: 'Affiche du casting (JPEG ou PNG, 10 Mo max)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Casting créé avec succès',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé (recruteur ou admin uniquement)',
  })
  async create(
    @UploadedFile() affiche: Express.Multer.File | undefined,
    @Body('payload') payload: string | undefined,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const parsedPayload = parsePayload<CreateCastingDto>(
      payload,
      body,
      'Le champ payload est requis et doit contenir un JSON valide.',
    );

    const dto = plainToInstance(CreateCastingDto, parsedPayload);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length) {
      throw new BadRequestException(extractValidationErrors(errors));
    }

    return this.castingsService.create(
      dto,
      String(user.id || user._id),
      user.role,
      affiche ?? undefined,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('affiche', castingPosterUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Met à jour un casting',
    description: 'Modifie les informations d\'un casting. Seul le recruteur propriétaire ou un admin peut modifier.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du casting à modifier',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        payload: {
          type: 'string',
          description:
            'Payload JSON contenant les champs à mettre à jour (`UpdateCastingDto`).',
          example: JSON.stringify({
            prix: 6500,
            types: ['Cinéma'],
          }),
        },
        affiche: {
          type: 'string',
          format: 'binary',
          description: 'Nouvelle affiche du casting (JPEG ou PNG, 10 Mo max)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Casting mis à jour avec succès',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous ne pouvez modifier que vos propres castings',
  })
  @ApiResponse({
    status: 404,
    description: 'Casting non trouvé',
  })
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile() affiche: Express.Multer.File | undefined,
    @Body('payload') payload: string | undefined,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const parsedPayload = parsePayload<Partial<UpdateCastingDto>>(
      payload,
      body,
      'Le corps de la requête est vide : fournissez des champs à mettre à jour ou une nouvelle affiche.',
      Boolean(affiche),
    );

    const dto = plainToInstance(UpdateCastingDto, parsedPayload);

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length) {
      throw new BadRequestException(extractValidationErrors(errors));
    }

    const hasPayloadChanges = Object.keys(parsedPayload).length > 0;
    if (!hasPayloadChanges && !affiche) {
      throw new BadRequestException(
        'Aucune donnée valide fournie pour mettre à jour le casting.',
      );
    }

    return this.castingsService.update(
      id,
      dto,
      String(user.id || user._id),
      user.role,
      affiche ?? undefined,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Supprime un casting',
    description: 'Supprime définitivement un casting. Seul le recruteur propriétaire ou un admin peut supprimer.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du casting à supprimer',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Casting supprimé avec succès',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous ne pouvez supprimer que vos propres castings',
  })
  @ApiResponse({
    status: 404,
    description: 'Casting non trouvé',
  })
  remove(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.castingsService.remove(id, String(user.id || user._id), user.role);
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ACTEUR)
  @UseInterceptors(FileInterceptor('video', auditionVideoUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Postuler à un casting',
    description: 'Permet à un acteur de postuler à un casting spécifique. Le casting doit être ouvert. Vidéo d\'audition optionnelle (max 30s, max 50MB).',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du casting auquel postuler',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        video: {
          type: 'string',
          format: 'binary',
          description: 'Vidéo d\'audition (optionnel, max 30s, max 50MB)',
        },
        aiFeedback: {
          type: 'string',
          description: 'Feedback IA généré côté frontend (JSON string, optionnel)',
          example: JSON.stringify({
            globalScore: 75,
            emotions: { detected: ['joie'], coherence: 80, intensity: 70, comment: 'Bien exprimé' },
            posture: { score: 70, strengths: ['Bonne posture'], improvements: [], comment: 'Correct' },
            intonation: { score: 75, clarity: 80, rhythm: 70, expressiveness: 75, comment: 'Bon' },
            expressivite: { score: 80, facialExpressions: 'Expressif', bodyLanguage: 'Naturel', comment: 'Très bien' },
            recommendations: ['Varier le ton'],
            strengths: ['Bonne diction'],
            summary: 'Performance solide',
          }),
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Candidature enregistrée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Le casting n\'accepte plus de candidatures ou vidéo invalide',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé (acteur uniquement)',
  })
  @ApiResponse({
    status: 404,
    description: 'Casting non trouvé',
  })
  @ApiResponse({
    status: 409,
    description: 'Vous avez déjà postulé à ce casting',
  })
  async applyToCasting(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: any,
    @UploadedFile() video?: Express.Multer.File,
    @Body('aiFeedback') aiFeedback?: string,
  ) {
    // Logs de diagnostic pour déboguer les erreurs 403
    console.log('[CastingsController] Candidature à un casting:', {
      castingId: id,
      hasUser: !!user,
      userId: user?.id || user?._id,
      userRole: user?.role,
      userType: user?.type,
      userEmail: user?.email,
      userObject: user ? {
        id: user.id,
        _id: user._id ? String(user._id) : undefined,
        role: user.role,
        type: user.type,
        email: user.email,
        allKeys: Object.keys(user),
      } : null,
    });

    // Extraire l'ID utilisateur avec plusieurs fallbacks
    const acteurId = user?.id 
      ? String(user.id)
      : user?._id 
        ? String(user._id)
        : user?.sub
          ? String(user.sub)
          : null;

    if (!acteurId) {
      console.error('[CastingsController] ERREUR: Impossible d\'extraire l\'ID utilisateur', {
        userObject: user,
        userKeys: user ? Object.keys(user) : [],
      });
      throw new ForbiddenException('Impossible d\'identifier l\'utilisateur. Veuillez vous reconnecter.');
    }

    console.log('[CastingsController] ID utilisateur extrait:', acteurId);

    const dto = aiFeedback ? { aiFeedback } : undefined;
    return this.castingsService.applyToCasting(
      id,
      acteurId,
      video,
      dto,
    );
  }

  @Patch(':id/candidates/:acteurId/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Accepter un candidat',
    description: 'Permet au recruteur ou à un admin d\'accepter un candidat pour un casting',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du casting',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'acteurId',
    description: 'ID de l\'acteur à accepter',
    example: '507f1f77bcf86cd799439012',
  })
  @ApiResponse({
    status: 200,
    description: 'Candidat accepté avec succès',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous ne pouvez modifier que vos propres castings',
  })
  @ApiResponse({
    status: 404,
    description: 'Casting ou candidat non trouvé',
  })
  acceptCandidate(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('acteurId', ParseObjectIdPipe) acteurId: string,
    @CurrentUser() user: any,
  ) {
    return this.castingsService.acceptCandidate(
      id,
      acteurId,
      String(user.id || user._id),
      user.role,
    );
  }

  @Post(':id/candidates/:acteurId/accept-with-interview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECRUTEUR, Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Accepter un candidat avec dates d\'interview',
    description: 'Permet au recruteur de accepter un candidat et de proposer 3 dates d\'interview. Crée automatiquement une interview.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du casting',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'acteurId',
    description: 'ID de l\'acteur à accepter',
    example: '507f1f77bcf86cd799439012',
  })
  @ApiBody({
    description: '3 dates d\'interview proposées',
    schema: {
      type: 'object',
      required: ['proposedDates'],
      properties: {
        proposedDates: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: {
            type: 'object',
            required: ['date'],
            properties: {
              date: {
                type: 'string',
                format: 'date',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                example: '2025-12-03',
                description: 'Date au format YYYY-MM-DD',
              },
              time: {
                type: 'string',
                pattern: '^\\d{2}:\\d{2}$',
                example: '14:00',
                description: 'Heure au format HH:mm (optionnel)',
              },
            },
          },
          example: [
            { date: '2025-12-03', time: '14:00' },
            { date: '2025-12-04', time: '14:00' },
            { date: '2025-12-05', time: '14:00' },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Candidat accepté et interview créée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Dates invalides, moins de 3 dates, dates dans le passé, ou candidat non en attente',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous n\'êtes pas propriétaire du casting',
  })
  @ApiResponse({
    status: 404,
    description: 'Casting ou acteur non trouvé',
  })
  @ApiResponse({
    status: 409,
    description: 'Interview déjà créée pour ce candidat',
  })
  async acceptCandidateWithInterview(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('acteurId', ParseObjectIdPipe) acteurId: string,
    @Body() dto: AcceptCandidateWithInterviewDto,
    @CurrentUser() user: any,
  ) {
    // Valider le DTO
    const validatedDto = plainToInstance(AcceptCandidateWithInterviewDto, dto);
    const errors = await validate(validatedDto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length) {
      throw new BadRequestException(extractValidationErrors(errors));
    }

    return this.castingsService.acceptCandidateWithInterview(
      id,
      acteurId,
      String(user.id || user._id),
      user.role,
      validatedDto,
    );
  }

  @Patch(':id/candidates/:acteurId/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Refuser un candidat',
    description: 'Permet au recruteur ou à un admin de refuser un candidat pour un casting',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du casting',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'acteurId',
    description: 'ID de l\'acteur à refuser',
    example: '507f1f77bcf86cd799439012',
  })
  @ApiResponse({
    status: 200,
    description: 'Candidat refusé avec succès',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous ne pouvez modifier que vos propres castings',
  })
  @ApiResponse({
    status: 404,
    description: 'Casting ou candidat non trouvé',
  })
  rejectCandidate(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('acteurId', ParseObjectIdPipe) acteurId: string,
    @CurrentUser() user: any,
  ) {
    return this.castingsService.rejectCandidate(
      id,
      acteurId,
      String(user.id || user._id),
      user.role,
    );
  }

  @Get(':id/my-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ACTEUR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtenir mon statut de candidature',
    description: 'Permet à un acteur de voir son statut de candidature pour un casting',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du casting',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Statut de candidature retourné',
    schema: {
      example: {
        hasApplied: true,
        statut: 'EN_ATTENTE',
        dateCandidature: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Casting non trouvé',
  })
  getMyStatus(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.castingsService.getCandidateStatus(
      id,
      String(user.id || user._id),
    );
  }

  @Get(':id/candidates/:acteurId/video')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Récupérer la vidéo d\'audition d\'un candidat',
    description: 'Permet au recruteur propriétaire du casting ou à l\'acteur concerné de récupérer la vidéo d\'audition',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du casting',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'acteurId',
    description: 'ID de l\'acteur candidat',
    example: '507f1f77bcf86cd799439012',
  })
  @ApiResponse({
    status: 200,
    description: 'Flux vidéo retourné avec succès',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé',
  })
  @ApiResponse({
    status: 404,
    description: 'Casting, candidat ou vidéo non trouvé',
  })
  async getCandidateVideo(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('acteurId', ParseObjectIdPipe) acteurId: string,
    @CurrentUser() user: any,
    @Request() req: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Logs de débogage pour diagnostiquer l'erreur 401
    console.log('[VIDEO] Requête reçue:', {
      castingId: id,
      acteurId: acteurId,
      hasUser: !!user,
      userId: user?.id || user?._id,
      userRole: user?.role,
      hasAuthHeader: !!req.headers?.authorization,
      authHeaderPrefix: req.headers?.authorization?.substring(0, 20) || 'N/A',
    });

    if (!user) {
      console.error('[VIDEO] ERREUR: User est null/undefined - Token non validé ou utilisateur non trouvé');
      throw new BadRequestException('Utilisateur non authentifié. Vérifiez votre token JWT.');
    }

    return this.castingsService.getCandidateVideo(
      id,
      acteurId,
      String(user.id || user._id),
      user.role,
      response,
    );
  }
}

