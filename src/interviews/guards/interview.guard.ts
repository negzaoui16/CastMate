import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { InterviewsService } from '../interviews.service';

@Injectable()
export class InterviewGuard implements CanActivate {
  constructor(private readonly interviewsService: InterviewsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const interviewId =
      request.params.id || request.params.interviewId;

    if (!interviewId) {
      return false;
    }

    try {
      // Vérifier que l'utilisateur peut accéder à l'interview
      return await this.interviewsService.canAccess(
        interviewId,
        String(user.id || user._id),
        user.role,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return false;
    }
  }
}

