import { IsDateString, IsNumber, IsOptional, IsString, Min, IsArray, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateCastingDto {
  @ApiPropertyOptional({
    description: 'Titre du casting',
    example: 'Recherche acteur principal pour série télévisée',
  })
  @IsOptional()
  @IsString()
  titre?: string;

  @ApiPropertyOptional({
    description: 'Description du rôle à pourvoir',
    example: 'Rôle de protagoniste masculin, 30-40 ans, expérience requise',
  })
  @IsOptional()
  @IsString()
  descriptionRole?: string;

  @ApiPropertyOptional({
    description: 'Synopsis du projet',
    example: 'Série dramatique sur la vie d\'un détective privé à Paris...',
  })
  @IsOptional()
  @IsString()
  synopsis?: string;

  @ApiPropertyOptional({
    description: 'Lieu de tournage',
    example: 'Paris, France',
  })
  @IsOptional()
  @IsString()
  lieu?: string;

  @ApiPropertyOptional({
    description: 'Date de début du tournage',
    example: '2024-01-15',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @ApiPropertyOptional({
    description: 'Date de fin du tournage',
    example: '2024-02-15',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @ApiPropertyOptional({
    description: 'Prix ou budget total du casting (en devise locale)',
    example: 5000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  prix?: number;

  @ApiPropertyOptional({
    description: 'Liste des types de casting',
    example: ['Cinéma', 'Télévision', 'Théâtre'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  types?: string[];

  @ApiPropertyOptional({
    description: 'Tranche d\'âge recherchée',
    example: '25-35 ans',
  })
  @IsOptional()
  @IsString()
  age?: string;

  @ApiPropertyOptional({
    description: 'Indique si le casting est ouvert aux candidatures',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  ouvert?: boolean;

  @ApiPropertyOptional({
    description: 'Conditions spécifiques',
    example: 'Disponibilité totale requise, permis de conduire obligatoire',
  })
  @IsOptional()
  @IsString()
  conditions?: string;
}

