import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PasswordResetTokenDocument = PasswordResetToken & Document;

@Schema({ timestamps: true })
export class PasswordResetToken {
  @Prop({ required: true, index: true })
  email: string;

  @Prop({ required: true, enum: ['ACTEUR', 'RECRUTEUR'] })
  userType: string;

  @Prop({ required: true, unique: true, index: true })
  token: string;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop({ default: false })
  used: boolean;
}

export const PasswordResetTokenSchema = SchemaFactory.createForClass(PasswordResetToken);

// Index composé pour recherche rapide
PasswordResetTokenSchema.index({ email: 1, userType: 1 });
// Index sur expiresAt pour nettoyage manuel (TTL index MongoDB nécessite createdAt, pas expiresAt)
PasswordResetTokenSchema.index({ expiresAt: 1 });

