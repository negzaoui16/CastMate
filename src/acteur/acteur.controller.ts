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
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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
import { ActeurService } from './acteur.service';
import { CreateActeurDto } from './dto/create-acteur.dto';
import { UpdateActeurDto } from './dto/update-acteur.dto';
import {
  ALLOWED_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../media/media.constants';
import { MediaService, MediaFilesPayload } from '../media/media.service';
import type { Express } from 'express';
import { extractValidationErrors } from '../common/utils/validation.util';

const ALLOWED_MIME_TYPE_SET = new Set<string>(ALLOWED_MIME_TYPES);
const GALLERY_MIME_TYPE_SET = new Set<string>(IMAGE_MIME_TYPES);

const acteurSignupUploadOptions: MulterOptions = {
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

const acteurGalleryUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, callback) => {
    if (GALLERY_MIME_TYPE_SET.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new BadRequestException(
          'Type de fichier non autorisé. La galerie accepte uniquement les images JPEG ou PNG.',
        ),
        false,
      );
    }
  },
};

@ApiTags('Acteurs')
@Controller('acteur')
export class ActeurController {
  constructor(
    private readonly acteurService: ActeurService,
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
      acteurSignupUploadOptions,
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: "Inscription d'un nouvel acteur",
    description:
      'Crée un nouveau compte acteur et stocke les fichiers médias associés dans GridFS.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['payload'],
      properties: {
        payload: {
          type: 'string',
          description:
            'Payload JSON contenant les informations du DTO `CreateActeurDto`.',
          example: JSON.stringify({
            nom: 'Dupont',
            prenom: 'Jean',
            email: 'jean.dupont@example.com',
            motDePasse: 'password123',
            tel: '+21612345678',
            age: 25,
            gouvernorat: 'Tunis',
            experience: 5,
            centresInteret: ['Théâtre', 'Cinéma'],
          }),
        },
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Photo de profil (JPEG ou PNG)',
        },
        document: {
          type: 'string',
          format: 'binary',
          description: 'Document PDF optionnel',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Acteur créé avec succès',
    schema: {
      example: {
        id: '507f1f77bcf86cd799439011',
        nom: 'Dupont',
        prenom: 'Jean',
        email: 'jean.dupont@example.com',
        role: 'ACTEUR',
        media: {
          photoFileId: '65b9f1f77bcf86cd799439011',
          photoMimeType: 'image/jpeg',
          documentFileId: '65b9f1f77bcf86cd799439022',
          documentMimeType: 'application/pdf',
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Un acteur avec cet email existe déjà',
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

    const dto = plainToInstance(CreateActeurDto, parsedPayload);
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

    const acteur = await this.acteurService.create(dto, mediaFiles);
    return {
      id: String(acteur._id),
      nom: acteur.nom,
      prenom: acteur.prenom,
      email: acteur.email,
      role: acteur.role,
      media: this.mediaService.serializeMedia(acteur.media),
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Liste tous les acteurs',
    description:
      'Récupère la liste de tous les acteurs. Réservé aux administrateurs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des acteurs retournée avec succès',
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
    return this.acteurService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Récupère un acteur par son ID',
    description: "Retourne les informations d'un acteur spécifique",
  })
  @ApiParam({
    name: 'id',
    description: "ID de l'acteur (MongoDB ObjectId)",
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Acteur trouvé',
  })
  @ApiResponse({
    status: 404,
    description: 'Acteur non trouvé',
  })
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    const acteur = await this.acteurService.findById(id);
    if (!acteur) {
      throw new NotFoundException('Acteur non trouvé');
    }
    return acteur;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Met à jour un acteur',
    description:
      "Modifie les informations d'un acteur. Un acteur ne peut modifier que son propre profil, sauf les admins qui peuvent modifier n'importe quel profil.",
  })
  @ApiParam({
    name: 'id',
    description: "ID de l'acteur à modifier",
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({ type: UpdateActeurDto })
  @ApiResponse({
    status: 200,
    description: 'Acteur mis à jour avec succès',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous ne pouvez modifier que votre propre profil',
  })
  @ApiResponse({
    status: 404,
    description: 'Acteur non trouvé',
  })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateActeurDto: UpdateActeurDto,
    @CurrentUser() currentUser: any,
  ) {
    const currentUserId = String(currentUser.id || currentUser._id);
    if (currentUser.role !== Role.ADMIN && currentUserId !== id) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que votre propre profil',
      );
    }
    return this.acteurService.update(id, updateActeurDto);
  }

  @Patch(':id/media/profile')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photo', maxCount: 1 },
        { name: 'document', maxCount: 1 },
      ],
      acteurSignupUploadOptions,
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Met à jour la photo de profil ou le CV PDF',
    description:
      'Remplace la photo de profil (JPEG/PNG) et/ou le CV PDF de l’acteur. Accessible au propriétaire ou à un administrateur.',
  })
  @ApiParam({
    name: 'id',
    description: "ID de l'acteur",
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Nouvelle photo de profil (JPEG ou PNG)',
        },
        document: {
          type: 'string',
          format: 'binary',
          description: 'Nouveau CV au format PDF',
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

    const acteur = await this.acteurService.updateMedia(
      id,
      mediaFiles,
      String(currentUser.id || currentUser._id),
      currentUser.role,
    );

    return {
      id: acteur.id,
      media: this.mediaService.serializeMedia(acteur.media),
    };
  }

  @Post(':id/media/gallery')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('photos', 10, acteurGalleryUploadOptions),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Ajoute des photos à la galerie',
    description:
      'Ajoute une ou plusieurs photos (JPEG/PNG) à la galerie personnelle de l’acteur. Accessible au propriétaire ou à un administrateur.',
  })
  @ApiParam({
    name: 'id',
    description: "ID de l'acteur",
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Photos supplémentaires (JPEG/PNG)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Photos ajoutées avec succès',
  })
  async addGalleryPhotos(
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFiles() photos: Express.Multer.File[],
    @CurrentUser() currentUser: any,
  ) {
    if (!photos || !photos.length) {
      throw new BadRequestException(
        'Veuillez sélectionner au moins une photo à ajouter.',
      );
    }

    const acteur = await this.acteurService.addGalleryPhotos(
      id,
      photos,
      String(currentUser.id || currentUser._id),
      currentUser.role,
    );

    return {
      id: acteur.id,
      media: this.mediaService.serializeMedia(acteur.media),
    };
  }

  @Delete(':id/media/gallery/:fileId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Supprime une photo de la galerie',
    description:
      'Retire une photo de la galerie personnelle de l’acteur. Accessible au propriétaire ou à un administrateur.',
  })
  @ApiParam({
    name: 'id',
    description: "ID de l'acteur",
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'fileId',
    description: 'ID du fichier image à supprimer (ObjectId GridFS)',
    example: '65b9f1f77bcf86cd799439055',
  })
  @ApiResponse({
    status: 200,
    description: 'Photo supprimée avec succès',
  })
  async removeGalleryPhoto(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('fileId', ParseObjectIdPipe) fileId: string,
    @CurrentUser() currentUser: any,
  ) {
    const acteur = await this.acteurService.removeGalleryPhoto(
      id,
      fileId,
      String(currentUser.id || currentUser._id),
      currentUser.role,
    );

    return {
      id: acteur.id,
      media: this.mediaService.serializeMedia(acteur.media),
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Supprime un acteur',
    description:
      'Supprime définitivement un acteur. Réservé aux administrateurs.',
  })
  @ApiParam({
    name: 'id',
    description: "ID de l'acteur à supprimer",
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Acteur supprimé avec succès',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé (admin uniquement)',
  })
  @ApiResponse({
    status: 404,
    description: 'Acteur non trouvé',
  })
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.acteurService.remove(id);
  }

  @Post(':id/favoris/:castingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Ajoute un casting aux favoris',
    description:
      'Ajoute un casting à la liste des favoris de l\'acteur. Accessible au propriétaire ou à un administrateur.',
  })
  @ApiParam({
    name: 'id',
    description: "ID de l'acteur",
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'castingId',
    description: 'ID du casting à ajouter aux favoris',
    example: '507f1f77bcf86cd799439012',
  })
  @ApiResponse({
    status: 200,
    description: 'Casting ajouté aux favoris avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Acteur ou casting non trouvé',
  })
  @ApiResponse({
    status: 409,
    description: 'Ce casting est déjà dans vos favoris',
  })
  async addFavori(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('castingId', ParseObjectIdPipe) castingId: string,
    @CurrentUser() currentUser: any,
  ) {
    const acteur = await this.acteurService.addFavori(
      id,
      castingId,
      String(currentUser.id || currentUser._id),
      currentUser.role,
    );

    return {
      id: acteur.id,
      favoris: acteur.favoris?.map((id) => String(id)) || [],
    };
  }

  @Delete(':id/favoris/:castingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Retire un casting des favoris',
    description:
      'Retire un casting de la liste des favoris de l\'acteur. Accessible au propriétaire ou à un administrateur.',
  })
  @ApiParam({
    name: 'id',
    description: "ID de l'acteur",
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'castingId',
    description: 'ID du casting à retirer des favoris',
    example: '507f1f77bcf86cd799439012',
  })
  @ApiResponse({
    status: 200,
    description: 'Casting retiré des favoris avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Acteur, casting non trouvé ou casting non présent dans les favoris',
  })
  async removeFavori(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('castingId', ParseObjectIdPipe) castingId: string,
    @CurrentUser() currentUser: any,
  ) {
    const acteur = await this.acteurService.removeFavori(
      id,
      castingId,
      String(currentUser.id || currentUser._id),
      currentUser.role,
    );

    return {
      id: acteur.id,
      favoris: acteur.favoris?.map((id) => String(id)) || [],
    };
  }

  @Get(':id/favoris')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Consulte la liste des favoris',
    description:
      'Récupère la liste complète des castings favoris de l\'acteur avec leurs détails. Accessible au propriétaire ou à un administrateur.',
  })
  @ApiParam({
    name: 'id',
    description: "ID de l'acteur",
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des favoris retournée avec succès',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous ne pouvez consulter que vos propres favoris',
  })
  @ApiResponse({
    status: 404,
    description: 'Acteur non trouvé',
  })
  async getFavoris(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() currentUser: any,
  ) {
    const castings = await this.acteurService.getFavoris(
      id,
      String(currentUser.id || currentUser._id),
      currentUser.role,
    );

    return castings;
  }

  @Patch(':id/hashpack')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Enregistre l\'adresse HashPack de l\'acteur',
    description: 'Permet à l\'acteur d\'associer son wallet HashPack à son compte',
  })
  @ApiParam({
    name: 'id',
    description: "ID de l'acteur",
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        hashpackAccountId: {
          type: 'string',
          description: 'Adresse du compte HashPack (format: 0.0.1234567)',
          example: '0.0.1234567',
        },
      },
      required: ['hashpackAccountId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Adresse HashPack enregistrée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Format d\'adresse HashPack invalide',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous ne pouvez modifier que votre propre profil',
  })
  async registerHashPack(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body('hashpackAccountId') hashpackAccountId: string,
    @CurrentUser() currentUser: any,
  ) {
    const currentUserId = String(currentUser.id || currentUser._id);
    if (currentUser.role !== Role.ADMIN && currentUserId !== id) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que votre propre profil',
      );
    }

    // Valider le format de l'adresse HashPack (0.0.xxxxxxx)
    if (!/^0\.0\.\d+$/.test(hashpackAccountId)) {
      throw new BadRequestException(
        'Format d\'adresse HashPack invalide. Format attendu: 0.0.1234567',
      );
    }

    const acteur = await this.acteurService.update(id, {
      hashpackAccountId,
    } as any);

    return {
      id: acteur.id,
      hashpackAccountId: acteur.hashpackAccountId,
    };
  }
}

