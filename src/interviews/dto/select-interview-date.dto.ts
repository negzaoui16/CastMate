import { IsString, IsOptional, Matches } from 'class-validator';

export class SelectInterviewDateDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date doit être au format YYYY-MM-DD' })
  selectedDate: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Heure doit être au format HH:mm' })
  selectedTime?: string;
}

