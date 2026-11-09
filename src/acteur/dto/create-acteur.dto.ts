import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  MinLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateActeurDto {
  @ApiProperty({
    description: 'Nom de l\'acteur',
    example: 'Dupont',
  })
  @IsNotEmpty()
  @IsString()
  nom: string;

  @ApiProperty({
    description: 'Prénom de l\'acteur',
    example: 'Jean',
  })
  @IsNotEmpty()
  @IsString()
  prenom: string;

  @ApiProperty({
    description: 'Adresse email (unique)',
    example: 'jean.dupont@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Mot de passe (minimum 6 caractères)',
    example: 'password123',
    minLength: 6,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  motDePasse: string;

  @ApiProperty({
    description: 'Numéro de téléphone',
    example: '+21612345678',
  })
  @IsNotEmpty()
  @IsString()
  tel: string;

  @ApiProperty({
    description: 'Âge de l\'acteur',
    example: 25,
    minimum: 1,
    maximum: 120,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(120)
  age: number;

  @ApiProperty({
    description: 'Gouvernorat de résidence',
    example: 'Tunis',
  })
  @IsNotEmpty()
  @IsString()
  gouvernorat: string;

  @ApiPropertyOptional({
    description: 'Années d\'expérience',
    example: 5,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  experience?: number;

  @ApiPropertyOptional({
    description: 'Liste des centres d\'intérêt',
    example: ['Théâtre', 'Cinéma', 'Télévision'],
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

