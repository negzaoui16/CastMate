import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class SocialLinksDto {
  @ApiPropertyOptional({
    description: 'Lien Facebook de l\'agence',
    example: 'https://facebook.com/agence-casting-tunis',
  })
  @IsOptional()
  @IsString()
  facebook?: string;

  @ApiPropertyOptional({
    description: 'Lien Instagram de l\'agence',
    example: 'https://instagram.com/agence_casting_tunis',
  })
  @IsOptional()
  @IsString()
  instagram?: string;
}

export class UpdateAgenceDto {
  @ApiPropertyOptional({
    description: 'Nom de l\'agence',
    example: 'Agence de Casting Tunis',
  })
  @IsOptional()
  @IsString()
  nomAgence?: string;

  @ApiPropertyOptional({
    description: 'Nom du responsable',
    example: 'Mohamed Ben Ali',
  })
  @IsOptional()
  @IsString()
  responsable?: string;

  @ApiPropertyOptional({
    description: 'Adresse email',
    example: 'contact@agence-casting.tn',
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
    description: 'Gouvernorat',
    example: 'Sfax',
  })
  @IsOptional()
  @IsString()
  gouvernorat?: string;

  @ApiPropertyOptional({
    description: 'Site web de l\'agence',
    example: 'https://www.agence-casting.tn',
  })
  @IsOptional()
  @IsString()
  siteWeb?: string;

  @ApiPropertyOptional({
    description: 'Description de l\'agence',
    example: 'Agence spécialisée dans le casting pour le cinéma et la télévision',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Liens vers les réseaux sociaux',
    type: SocialLinksDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;
}

