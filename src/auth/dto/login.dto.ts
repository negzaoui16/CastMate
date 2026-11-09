import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Adresse email',
    example: 'jean.dupont@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Mot de passe',
    example: 'password123',
  })
  @IsNotEmpty()
  @IsString()
  password: string;
}

