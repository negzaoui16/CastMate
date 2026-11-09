import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum UserType {
  ACTEUR = 'ACTEUR',
  RECRUTEUR = 'RECRUTEUR',
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  @IsEnum(UserType)
  userType!: UserType;

  @IsOptional()
  @IsString()
  @MinLength(32) // Token hex de 64 caractères minimum
  token?: string; // ⚠️ NOUVEAU : Optionnel, token généré par Android
}


