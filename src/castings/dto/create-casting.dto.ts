import { IsDateString, IsNotEmpty, IsNumber, IsString, Min, IsArray, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCastingDto {
  @ApiProperty({
    description: 'Titre du casting',
    example: 'Recherche acteur principal pour série télévisée',
  })
  @IsNotEmpty()
  @IsString()
  titre: string;

  @ApiProperty({
    description: 'Description du rôle à pourvoir',
    example: 'Rôle de protagoniste masculin, 30-40 ans, expérience requise',
  })
  @IsNotEmpty()
  @IsString()
  descriptionRole: string;

  @ApiProperty({
    description: 'Synopsis du projet',
    example: 'Série dramatique sur la vie d\'un détective privé à Paris...',
  })
  @IsNotEmpty()
  @IsString()
  synopsis: string;

  @ApiProperty({
    description: 'Lieu de tournage',
    example: 'Paris, France',
  })
  @IsNotEmpty()
  @IsString()
  lieu: string;

  @ApiProperty({
    description: 'Date de début du tournage',
    example: '2024-01-15',
    type: String,
    format: 'date',
  })
  @IsNotEmpty()
  @IsDateString()
  dateDebut: string;

  @ApiProperty({
    description: 'Date de fin du tournage',
    example: '2024-02-15',
    type: String,
    format: 'date',
  })
  @IsNotEmpty()
  @IsDateString()
  dateFin: string;

  @ApiProperty({
    description: 'Prix ou budget total du casting (en devise locale)',
    example: 5000,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  prix: number;

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
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  ouvert?: boolean;

  @ApiProperty({
    description: 'Conditions spécifiques',
    example: 'Disponibilité totale requise, permis de conduire obligatoire',
  })
  @IsNotEmpty()
  @IsString()
  conditions: string;
}

