import {
  Controller,
  Get,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { GridFSFile } from 'mongodb';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { MediaService } from './media.service';
import { Role } from '../common/enums/role.enum';

@ApiTags('Media')
@ApiBearerAuth('JWT-auth')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get(':fileId')
  @Public() // Permet l'accès public pour les images NFT
  @ApiOperation({
    summary: 'Télécharge un fichier média',
    description:
      'Retourne un flux binaire depuis GridFS. Les images NFT et les affiches de casting sont accessibles publiquement. Les photos de profil des agences sont accessibles à tous les utilisateurs authentifiés. Les autres fichiers (photos de profil acteurs, documents, galerie) sont accessibles uniquement au propriétaire ou aux administrateurs.',
  })
  @ApiParam({
    name: 'fileId',
    description: 'Identifiant du fichier stocké dans GridFS',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Flux du fichier retourné avec succès',
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
    description: 'Fichier non trouvé',
  })
  async streamFile(
    @Param('fileId', ParseObjectIdPipe) fileId: string,
    @CurrentUser() user: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Logs de diagnostic pour déboguer les erreurs 403
    console.log('[MediaController] Requête fichier:', {
      fileId: fileId,
      hasUser: !!user,
      userId: user?.id || user?._id,
      userRole: user?.role,
      userType: user?.type,
      userObject: user ? {
        id: user.id,
        _id: user._id ? String(user._id) : undefined,
        role: user.role,
        type: user.type,
        email: user.email,
      } : null,
    });

    // Pour les fichiers publics (NFT), user peut être undefined
    const requester = user || {};
    
    const { file, stream } = await this.mediaService.getFileStream(
      fileId,
      requester,
    );

    // Cache public pour les images NFT, les affiches de casting et les médias des acteurs
    const ownerRole = file.metadata?.ownerRole;
    const isPublicImage = 
      file.metadata?.field === 'nft_image' || 
      file.metadata?.field === 'casting_affiche' ||
      ownerRole === Role.ACTEUR; // Tous les médias des acteurs sont publics
    const cacheControl = isPublicImage
      ? 'public, max-age=31536000' // Cache 1 an pour les images publiques
      : 'private, no-cache';

    response.set({
      'Content-Type': file.contentType ?? 'application/octet-stream',
      ...(file.length ? { 'Content-Length': file.length.toString() } : {}),
      'Content-Disposition': this.buildContentDisposition(file),
      'Cache-Control': cacheControl,
    });

    return new StreamableFile(stream);
  }

  private buildContentDisposition(file: GridFSFile) {
    const sanitizedFilename = encodeURIComponent(
      file.filename ?? file.metadata?.originalName ?? 'media',
    );
    const isInline =
      file.contentType && file.contentType.startsWith('image/')
        ? 'inline'
        : 'attachment';
    return `${isInline}; filename="${sanitizedFilename}"`;
  }
}


