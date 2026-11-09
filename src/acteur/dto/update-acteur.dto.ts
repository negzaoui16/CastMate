import {
  IsEmail,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  MinLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class SocialLinksDto {
  @ApiPropertyOptional({
    description: 'Lien Instagram',
    example: 'https://instagram.com/acteur',
  })
  @IsOptional()
  @IsString()
  instagram?: string;

  @ApiPropertyOptional({
    description: 'Lien YouTube',
    example: 'https://youtube.com/@acteur',
  })
  @IsOptional()
  @IsString()
  youtube?: string;

  @ApiPropertyOptional({
    description: 'Lien TikTok',
    example: 'https://tiktok.com/@acteur',
  })
  @IsOptional()
  @IsString()
  tiktok?: string;
}

export class UpdateActeurDto {
  @ApiPropertyOptional({
    description: 'Nom de l\'acteur',
    example: 'Dupont',
  })
  @IsOptional()
  @IsString()
  nom?: string;

  @ApiPropertyOptional({
    description: 'Prénom de l\'acteur',
    example: 'Jean',
  })
  @IsOptional()
  @IsString()
  prenom?: string;

  @ApiPropertyOptional({
    description: 'Adresse email',
    example: 'jean.dupont@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Mot de passe (minimum 6 caractères)',
    example: 'newpassword123',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  motDePasse?: string;

  @ApiPropertyOptional({
    description: 'Numéro de téléphone',
    example: '+21612345678',
  })
  @IsOptional()
  @IsString()
  tel?: string;

  @ApiPropertyOptional({
    description: 'Âge de l\'acteur',
    example: 26,
    minimum: 1,
    maximum: 120,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  age?: number;

  @ApiPropertyOptional({
    description: 'Gouvernorat de résidence',
    example: 'Sfax',
  })
  @IsOptional()
  @IsString()
  gouvernorat?: string;

  @ApiPropertyOptional({
    description: 'Années d\'expérience',
    example: 6,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  experience?: number;

  @ApiPropertyOptional({
    description: 'Liste des centres d\'intérêt',
    example: ['Théâtre', 'Cinéma'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  centresInteret?: string[];

  @ApiPropertyOptional({
    description: 'Liens vers les réseaux sociaux',
    type: SocialLinksDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;
}

