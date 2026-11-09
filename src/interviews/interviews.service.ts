import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Interview, InterviewDocument } from './schemas/interview.schema';
import { AcceptCandidateWithInterviewDto } from './dto/accept-candidate-with-interview.dto';
import { SelectInterviewDateDto } from './dto/select-interview-date.dto';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class InterviewsService {
  constructor(
    @InjectModel(Interview.name)
    private interviewModel: Model<InterviewDocument>,
  ) {}

  async create(
    castingId: string,
    castingTitle: string,
    acteurId: string,
    acteurName: string,
    agenceId: string,
    agenceName: string,
    dto: AcceptCandidateWithInterviewDto,
  ): Promise<InterviewDocument> {
    // Vérifier qu'il n'existe pas déjà une interview pour ce candidat et ce casting
    const existingInterview = await this.interviewModel
      .findOne({
        castingId: new Types.ObjectId(castingId),
        acteurId: new Types.ObjectId(acteurId),
      })
      .exec();

    if (existingInterview) {
      throw new ConflictException(
        'Une interview existe déjà pour ce candidat et ce casting',
      );
    }

    // Vérifier que les dates sont uniques
    const dates = dto.proposedDates.map((d) => d.date);
    const uniqueDates = new Set(dates);
    if (uniqueDates.size !== dates.length) {
      throw new BadRequestException(
        'Les dates proposées doivent être uniques',
      );
    }

    // Valider que les dates sont dans le futur
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    for (const dateOption of dto.proposedDates) {
      const dateOnly = new Date(dateOption.date);
      dateOnly.setHours(0, 0, 0, 0);
      
      // Si une heure est fournie, valider la date+heure complète
      if (dateOption.time) {
        const [hours, minutes] = dateOption.time.split(':').map(Number);
        const fullDateTime = new Date(dateOption.date);
        fullDateTime.setHours(hours, minutes, 0, 0);
        
        if (fullDateTime <= now) {
          throw new BadRequestException(
            `La date ${dateOption.date} à ${dateOption.time} doit être dans le futur`,
          );
        }
      } else {
        // Si pas d'heure, la date doit être au moins demain
        if (dateOnly <= today) {
          throw new BadRequestException(
            `La date ${dateOption.date} doit être dans le futur`,
          );
        }
      }
    }

    // Préparer les dates proposées
    const proposedDates = dto.proposedDates.map((dateOption) => ({
      date: dateOption.date,
      time: dateOption.time,
      isSelected: false,
    }));

    const interview = new this.interviewModel({
      castingId: new Types.ObjectId(castingId),
      castingTitle,
      acteurId: new Types.ObjectId(acteurId),
      acteurName,
      agenceId: new Types.ObjectId(agenceId),
      agenceName,
      proposedDates,
      status: 'PENDING',
    });

    return await interview.save();
  }

  async findOne(id: string): Promise<InterviewDocument> {
    const interview = await this.interviewModel.findById(id).exec();
    if (!interview) {
      throw new NotFoundException('Interview non trouvée');
    }
    return interview;
  }

  async findOneByCastingAndActeur(
    castingId: string,
    acteurId: string,
  ): Promise<InterviewDocument | null> {
    return this.interviewModel
      .findOne({
        castingId: new Types.ObjectId(castingId),
        acteurId: new Types.ObjectId(acteurId),
      })
      .exec();
  }

  async selectDate(
    interviewId: string,
    acteurId: string,
    dto: SelectInterviewDateDto,
  ): Promise<InterviewDocument> {
    const interview = await this.findOne(interviewId);

    // Vérifier que l'utilisateur est l'acteur concerné
    if (String(interview.acteurId) !== acteurId) {
      throw new ForbiddenException(
        'Vous n\'êtes pas autorisé à modifier cette interview',
      );
    }

    // Vérifier que le statut est PENDING
    if (interview.status !== 'PENDING') {
      throw new BadRequestException(
        'Cette interview n\'est plus en attente de confirmation',
      );
    }

    // Vérifier que la date sélectionnée est dans les dates proposées
    const proposedDate = interview.proposedDates.find(
      (pd) => pd.date === dto.selectedDate,
    );

    if (!proposedDate) {
      throw new BadRequestException(
        'La date sélectionnée doit être parmi les dates proposées',
      );
    }

    // Mettre à jour l'interview
    interview.selectedDate = dto.selectedDate;
    interview.selectedTime = dto.selectedTime || proposedDate.time;
    interview.status = 'CONFIRMED';

    // Marquer la date choisie comme sélectionnée
    interview.proposedDates = interview.proposedDates.map((pd) => ({
      ...pd,
      isSelected: pd.date === dto.selectedDate,
    }));

    return await interview.save();
  }

  async findByActeur(
    acteurId: string,
    status?: string,
  ): Promise<InterviewDocument[]> {
    const query: any = { acteurId: new Types.ObjectId(acteurId) };
    if (status) {
      query.status = status;
    }

    return this.interviewModel
      .find(query)
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByAgence(
    agenceId: string,
    status?: string,
    castingId?: string,
  ): Promise<InterviewDocument[]> {
    const query: any = { agenceId: new Types.ObjectId(agenceId) };
    if (status) {
      query.status = status;
    }
    if (castingId) {
      query.castingId = new Types.ObjectId(castingId);
    }

    return this.interviewModel
      .find(query)
      .sort({ createdAt: -1 })
      .exec();
  }

  async cancel(interviewId: string, userId: string, userRole: Role): Promise<InterviewDocument> {
    const interview = await this.findOne(interviewId);

    // Vérifier que l'utilisateur est l'acteur ou l'agence concernée
    const isActeur = String(interview.acteurId) === userId;
    const isAgence = String(interview.agenceId) === userId;
    const isAdmin = userRole === Role.ADMIN;

    if (!isActeur && !isAgence && !isAdmin) {
      throw new ForbiddenException(
        'Vous n\'êtes pas autorisé à annuler cette interview',
      );
    }

    // Vérifier que le statut n'est pas déjà CANCELLED
    if (interview.status === 'CANCELLED') {
      throw new BadRequestException('Cette interview est déjà annulée');
    }

    interview.status = 'CANCELLED';
    return await interview.save();
  }

  async canAccess(interviewId: string, userId: string, userRole: Role): Promise<boolean> {
    const interview = await this.findOne(interviewId);
    const isActeur = String(interview.acteurId) === userId;
    const isAgence = String(interview.agenceId) === userId;
    const isAdmin = userRole === Role.ADMIN;
    return isActeur || isAgence || isAdmin;
  }
}

