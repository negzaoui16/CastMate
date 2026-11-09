import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AgenceDocument = Agence & Document;

@Schema({ timestamps: true })
export class Agence {
  @Prop({ required: true })
  nomAgence: string;

  @Prop({ required: true })
  responsable: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  motDePasse: string;

  @Prop({ required: true })
  tel: string;

  @Prop({ required: true })
  gouvernorat: string;

  @Prop({ required: false })
  siteWeb?: string;

  @Prop({ required: false })
  description?: string;

  @Prop({
    type: {
      facebook: { type: String, required: false },
      instagram: { type: String, required: false },
    },
    required: false,
    _id: false,
  })
  socialLinks?: {
    facebook?: string;
    instagram?: string;
  };

  @Prop({
    type: {
      photoFileId: { type: Types.ObjectId, required: false },
      photoMimeType: { type: String, required: false },
      photoOriginalName: { type: String, required: false },
      photoLength: { type: Number, required: false },
      photoUploadDate: { type: Date, required: false },
      documentFileId: { type: Types.ObjectId, required: false },
      documentMimeType: { type: String, required: false },
      documentOriginalName: { type: String, required: false },
      documentLength: { type: Number, required: false },
      documentUploadDate: { type: Date, required: false },
    },
    required: false,
    _id: false,
    default: undefined,
  })
  media?: {
    photoFileId?: Types.ObjectId;
    photoMimeType?: string;
    photoOriginalName?: string;
    photoLength?: number;
    photoUploadDate?: Date;
    documentFileId?: Types.ObjectId;
    documentMimeType?: string;
    documentOriginalName?: string;
    documentLength?: number;
    documentUploadDate?: Date;
  };

  @Prop({ required: true, default: 'RECRUTEUR' })
  role: string;

  @Prop({ default: Date.now })
  dateCreation: Date;

  @Prop({ type: String, required: false, default: null })
  resetPasswordToken?: string | null;

  @Prop({ type: Date, required: false, default: null })
  resetPasswordExpiry?: Date | null;

  @Prop({
    type: {
      windowStart: { type: Date, required: false },
      count: { type: Number, required: false, default: 0 },
    },
    required: false,
    _id: false,
    default: undefined,
  })
  resetPasswordRequests?: {
    windowStart?: Date;
    count?: number;
  };
}

export const AgenceSchema = SchemaFactory.createForClass(Agence);

const transformMedia = (media: any) => {
  if (!media) {
    return;
  }
  if (media.photoFileId) {
    media.photoFileId = String(media.photoFileId);
  }
  if (media.documentFileId) {
    media.documentFileId = String(media.documentFileId);
  }
};

const transformDocument = (_doc: AgenceDocument, ret: any) => {
  ret.id = String(ret._id);
  delete ret._id;
  if (ret.motDePasse) {
    delete ret.motDePasse;
  }
  transformMedia(ret.media);
  return ret;
};

AgenceSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: transformDocument,
});

AgenceSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: transformDocument,
});

