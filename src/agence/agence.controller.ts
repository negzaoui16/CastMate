import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AgenceService } from './agence.service';
import { CreateAgenceDto } from './dto/create-agence.dto';
import { UpdateAgenceDto } from './dto/update-agence.dto';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../media/media.constants';
import { MediaService, MediaFilesPayload } from '../media/media.service';
import type { Express } from 'express';
import { extractValidationErrors } from '../common/utils/validation.util';

const ALLOWED_MIME_TYPE_SET = new Set<string>(ALLOWED_MIME_TYPES);

const agenceSignupUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_MIME_TYPE_SET.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new BadRequestException(
          'Type de fichier non autorisé. Formats acceptés : JPEG, PNG, PDF.',
        ),
        false,
      );
    }
  },
};

@ApiTags('Agences')
@Controller('agence')
export class AgenceController {
  constructor(
    private readonly agenceService: AgenceService,
    private readonly mediaService: MediaService,
  ) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photo', maxCount: 1 },
        { name: 'document', maxCount: 1 },
      ],
      agenceSignupUploadOptions,
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: "Inscription d'une nouvelle agence",
    description:
      "Crée un nouveau compte agence et stocke les fichiers médias (logo, documents) dans GridFS.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['payload'],
      properties: {
        payload: {
          type: 'string',
          description:
            'Payload JSON contenant les informations du DTO `CreateAgenceDto`.',
          example: JSON.stringify({
            nomAgence: 'Agence de Casting Tunis',
            responsable: 'Mohamed Ben Ali',
            email: 'contact@agence-casting.tn',
            motDePasse: 'password123',
            tel: '+21612345678',
            gouvernorat: 'Tunis',
            siteWeb: 'https://agence-casting.tn',
            description: 'Agence spécialisée dans le casting.',
            socialLinks: {
              facebook: 'https://facebook.com/agence-casting-tunis',
              instagram: 'https://instagram.com/agence_casting_tunis',
            },
          }),
        },
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Logo / image de l’agence (JPEG ou PNG)',
        },
        document: {
          type: 'string',
          format: 'binary',
          description: 'Document PDF optionnel (certifications, etc.)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Agence créée avec succès',
    schema: {
      example: {
        id: '507f1f77bcf86cd799439011',
        nomAgence: 'Agence de Casting Tunis',
        email: 'contact@agence-casting.tn',
        role: 'RECRUTEUR',
        media: {
          photoFileId: '65b9f1f77bcf86cd799439031',
          photoMimeType: 'image/png',
          documentFileId: '65b9f1f77bcf86cd799439045',
          documentMimeType: 'application/pdf',
        },
        socialLinks: {
          facebook: 'https://facebook.com/agence-casting-tunis',
          instagram: 'https://instagram.com/agence_casting_tunis',
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Une agence avec cet email existe déjà',
  })
  async signup(
    @UploadedFiles()
    files: {
      photo?: Express.Multer.File[];
      document?: Express.Multer.File[];
    },
    @Body('payload') payload?: string,
  ) {
    if (!payload) {
      throw new BadRequestException(
        'Le champ payload est requis et doit contenir un JSON valide.',
      );
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payload);
    } catch (error) {
      throw new BadRequestException(
        'Le champ payload doit contenir un JSON valide.',
      );
    }

    const dto = plainToInstance(CreateAgenceDto, parsedPayload);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length) {
      throw new BadRequestException(extractValidationErrors(errors));
    }

    const mediaFiles: MediaFilesPayload = {
      photo: files?.photo?.[0],
      document: files?.document?.[0],
    };

    const agence = await this.agenceService.create(dto, mediaFiles);
    return {
      id: String(agence._id),
      nomAgence: agence.nomAgence,
      responsable: agence.responsable,
      email: agence.email,
      role: agence.role,
      media: this.mediaService.serializeMedia(agence.media),
      socialLinks: agence.socialLinks,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Liste toutes les agences',
    description:
      'Récupère la liste de toutes les agences. Réservé aux administrateurs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des agences retournée avec succès',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé (admin uniquement)',
  })
  findAll() {
    return this.agenceService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Récupère une agence par son ID',
    description: 'Retourne les informations d\'une agence spécifique',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'agence (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Agence trouvée',
  })
  @ApiResponse({
    status: 404,
    description: 'Agence non trouvée',
  })
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    const agence = await this.agenceService.findById(id);
    if (!agence) {
      throw new NotFoundException('Agence non trouvée');
    }
    return agence;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Met à jour une agence',
    description: 'Modifie les informations d\'une agence. Une agence ne peut modifier que son propre profil, sauf les admins qui peuvent modifier n\'importe quel profil.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'agence à modifier',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({ type: UpdateAgenceDto })
  @ApiResponse({
    status: 200,
    description: 'Agence mise à jour avec succès',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous ne pouvez modifier que votre propre profil',
  })
  @ApiResponse({
    status: 404,
    description: 'Agence non trouvée',
  })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateAgenceDto: UpdateAgenceDto,
    @CurrentUser() currentUser: any,
  ) {
    // L'agence ne peut modifier que son propre profil, sauf si c'est un admin
    const currentUserId = String(currentUser.id || currentUser._id);
    if (currentUser.role !== Role.ADMIN && currentUserId !== id) {
      throw new ForbiddenException('Vous ne pouvez modifier que votre propre profil');
    }
    return this.agenceService.update(id, updateAgenceDto);
  }

  @Patch(':id/media/profile')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photo', maxCount: 1 },
        { name: 'document', maxCount: 1 },
      ],
      agenceSignupUploadOptions,
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Met à jour la photo de profil ou le document PDF',
    description:
      'Remplace la photo de profil (JPEG/PNG) et/ou le document PDF de l\'agence. Accessible au propriétaire ou à un administrateur.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'agence',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Médias mis à jour avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Aucun fichier valide fourni',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous ne pouvez modifier que votre propre profil',
  })
  @ApiResponse({
    status: 404,
    description: 'Agence non trouvée',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Nouvelle photo/logo de l\'agence (JPEG ou PNG)',
        },
        document: {
          type: 'string',
          format: 'binary',
          description: 'Nouveau document au format PDF',
        },
      },
    },
  })
  async updateProfileMedia(
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFiles()
    files: {
      photo?: Express.Multer.File[];
      document?: Express.Multer.File[];
    },
    @CurrentUser() currentUser: any,
  ) {
    const mediaFiles: MediaFilesPayload = {
      photo: files?.photo?.[0],
      document: files?.document?.[0],
    };

    if (!mediaFiles.photo && !mediaFiles.document) {
      throw new BadRequestException(
        'Veuillez fournir une photo ou un document à mettre à jour.',
      );
    }

    const agence = await this.agenceService.updateMedia(
      id,
      mediaFiles,
      String(currentUser.id || currentUser._id),
      currentUser.role,
    );

    return {
      id: agence.id,
      media: this.mediaService.serializeMedia(agence.media),
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Supprime une agence',
    description: 'Supprime définitivement une agence. Réservé aux administrateurs.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'agence à supprimer',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Agence supprimée avec succès',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé (admin uniquement)',
  })
  @ApiResponse({
    status: 404,
    description: 'Agence non trouvée',
  })
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.agenceService.remove(id);
  }
}

