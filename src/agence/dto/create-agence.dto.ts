import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateAgenceDto {
  @ApiProperty({
    description: 'Nom de l\'agence',
    example: 'Agence de Casting Tunis',
  })
  @IsNotEmpty()
  @IsString()
  nomAgence: string;

  @ApiProperty({
    description: 'Nom du responsable',
    example: 'Mohamed Ben Ali',
  })
  @IsNotEmpty()
  @IsString()
  responsable: string;

  @ApiProperty({
    description: 'Adresse email (unique)',
    example: 'contact@agence-casting.tn',
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
    description: 'Gouvernorat',
    example: 'Tunis',
  })
  @IsNotEmpty()
  @IsString()
  gouvernorat: string;

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

