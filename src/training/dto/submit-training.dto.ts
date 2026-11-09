import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsArray,
  IsString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EmotionsDto {
  @ApiProperty({
    example: ['joie', 'enthousiasme'],
    description: 'Émotions détectées',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  detected: string[];

  @ApiProperty({
    example: 90,
    description: 'Cohérence des émotions (0-100)',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  coherence: number;

  @ApiProperty({
    example: 85,
    description: 'Intensité des émotions (0-100)',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  intensity: number;
}

export class SubmitTrainingDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: "ID de l'acteur",
  })
  @IsNotEmpty()
  @IsString()
  acteurId: string;

  @ApiProperty({
    example: 1,
    description: 'Numéro du niveau (1, 2, 3, ...)',
  })
  @IsNumber()
  @Min(1)
  niveau: number;

  @ApiProperty({
    example: 88,
    description: 'Score global (0-100)',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  globalScore: number;

  @ApiProperty({
    type: EmotionsDto,
    description: 'Détails des émotions',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => EmotionsDto)
  emotions: EmotionsDto;

  @ApiProperty({
    example: ['Excellent contact visuel', 'Émotions authentiques'],
    description: 'Points forts de la performance',
  })
  @IsArray()
  @IsString({ each: true })
  strengths: string[];

  @ApiProperty({
    example: ['Amplifier les émotions', 'Varier le rythme'],
    description: 'Recommandations d\'amélioration',
  })
  @IsArray()
  @IsString({ each: true })
  recommendations: string[];
}

