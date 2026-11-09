import {
  IsArray,
  IsString,
  IsOptional,
  Matches,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InterviewDateOptionDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date doit être au format YYYY-MM-DD' })
  date: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Heure doit être au format HH:mm' })
  time?: string;
}

export class AcceptCandidateWithInterviewDto {
  @IsArray()
  @ArrayMinSize(3, { message: 'Vous devez proposer exactement 3 dates' })
  @ArrayMaxSize(3, { message: 'Vous devez proposer exactement 3 dates' })
  @ValidateNested({ each: true })
  @Type(() => InterviewDateOptionDto)
  proposedDates: InterviewDateOptionDto[];
}

