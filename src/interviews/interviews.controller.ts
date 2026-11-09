import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InterviewsService } from './interviews.service';
import { SelectInterviewDateDto } from './dto/select-interview-date.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';

@ApiTags('Interviews')
@Controller('interviews')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Patch(':id/select-date')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ACTEUR)
  @ApiOperation({
    summary: 'Sélectionner une date d\'interview',
    description: 'Permet à un acteur de choisir une date parmi celles proposées pour l\'interview',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'interview',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Date sélectionnée avec succès, interview confirmée',
  })
  @ApiResponse({
    status: 400,
    description: 'Date non proposée ou interview déjà confirmée/annulée',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous n\'êtes pas l\'acteur concerné',
  })
  @ApiResponse({
    status: 404,
    description: 'Interview non trouvée',
  })
  async selectDate(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SelectInterviewDateDto,
    @CurrentUser() user: any,
  ) {
    return this.interviewsService.selectDate(
      id,
      String(user.id || user._id),
      dto,
    );
  }

  @Get('actor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ACTEUR)
  @ApiOperation({
    summary: 'Obtenir les interviews d\'un acteur',
    description: 'Récupère toutes les interviews de l\'acteur connecté, optionnellement filtrées par statut',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
    description: 'Filtrer par statut',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des interviews retournée avec succès',
    schema: {
      example: {
        interviews: [
          {
            id: '507f1f77bcf86cd799439011',
            castingId: '507f1f77bcf86cd799439012',
            castingTitle: 'Casting série dramatique',
            acteurId: '507f1f77bcf86cd799439013',
            acteurName: 'Jean Dupont',
            agenceId: '507f1f77bcf86cd799439014',
            agenceName: 'Agence Talent',
            proposedDates: [
              { date: '2025-12-03', time: '14:00', isSelected: true },
              { date: '2025-12-04', time: '14:00', isSelected: false },
              { date: '2025-12-05', time: '14:00', isSelected: false },
            ],
            selectedDate: '2025-12-03',
            selectedTime: '14:00',
            status: 'CONFIRMED',
            createdAt: '2025-01-27T10:00:00.000Z',
            updatedAt: '2025-01-27T10:30:00.000Z',
          },
        ],
      },
    },
  })
  async getActorInterviews(
    @Query('status') status: string | undefined,
    @CurrentUser() user: any,
  ) {
    const interviews = await this.interviewsService.findByActeur(
      String(user.id || user._id),
      status,
    );
    return { interviews };
  }

  @Get('agency')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECRUTEUR, Role.ADMIN)
  @ApiOperation({
    summary: 'Obtenir les interviews d\'une agence',
    description: 'Récupère toutes les interviews de l\'agence connectée, optionnellement filtrées par statut ou casting',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
    description: 'Filtrer par statut',
  })
  @ApiQuery({
    name: 'castingId',
    required: false,
    description: 'Filtrer par ID de casting',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des interviews retournée avec succès',
  })
  async getAgencyInterviews(
    @Query('status') status: string | undefined,
    @Query('castingId') castingId: string | undefined,
    @CurrentUser() user: any,
  ) {
    // Validation du format du castingId si fourni
    if (castingId) {
      try {
        new ParseObjectIdPipe().transform(castingId, { type: 'param', data: 'castingId' });
      } catch (error) {
        throw new BadRequestException('Format de castingId invalide');
      }
    }

    const interviews = await this.interviewsService.findByAgence(
      String(user.id || user._id),
      status,
      castingId,
    );
    return { interviews };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Obtenir une interview par ID',
    description: 'Récupère les détails d\'une interview spécifique. L\'utilisateur doit être l\'acteur concerné ou l\'agence propriétaire.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'interview',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Interview trouvée',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous n\'êtes pas autorisé à voir cette interview',
  })
  @ApiResponse({
    status: 404,
    description: 'Interview non trouvée',
  })
  async getInterview(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const canAccess = await this.interviewsService.canAccess(
      id,
      String(user.id || user._id),
      user.role,
    );

    if (!canAccess) {
      throw new BadRequestException(
        'Vous n\'êtes pas autorisé à voir cette interview',
      );
    }

    return this.interviewsService.findOne(id);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Annuler une interview',
    description: 'Permet à l\'acteur concerné ou à l\'agence propriétaire d\'annuler une interview',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'interview à annuler',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Interview annulée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Interview déjà annulée',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous n\'êtes pas autorisé à annuler cette interview',
  })
  @ApiResponse({
    status: 404,
    description: 'Interview non trouvée',
  })
  async cancelInterview(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.interviewsService.cancel(
      id,
      String(user.id || user._id),
      user.role,
    );
  }
}

