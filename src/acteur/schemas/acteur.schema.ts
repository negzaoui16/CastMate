import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActeurDocument = Acteur & Document;

@Schema({ timestamps: true })
export class Acteur {
  @Prop({ required: true })
  nom: string;

  @Prop({ required: true })
  prenom: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  motDePasse: string;

  @Prop({ required: true })
  tel: string;

  @Prop({ required: true })
  age: number;

  @Prop({ required: true })
  gouvernorat: string;

  @Prop({ required: true, default: 0 })
  experience: number;

  @Prop({ type: [String], default: [] })
  centresInteret: string[];

  @Prop({ type: [Types.ObjectId], ref: 'Casting', default: [] })
  favoris: Types.ObjectId[];

  @Prop({ type: String, required: false, default: null })
  resetPasswordToken?: string | null;

  @Prop({ type: Date, required: false, default: null })
  resetPasswordExpiry?: Date | null;

  // Petite fenêtre de rate-limit: 5 requêtes/h
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
      gallery: {
        type: [
          {
            _id: false,
            fileId: { type: Types.ObjectId, required: true },
            mimeType: { type: String, required: true },
            originalName: { type: String, required: true },
            length: { type: Number, required: true },
            uploadDate: { type: Date, required: true },
          },
        ],
        default: undefined,
      },
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
    gallery?: {
      fileId: Types.ObjectId;
      mimeType: string;
      originalName: string;
      length: number;
      uploadDate: Date;
    }[];
  };

  @Prop({
    type: {
      instagram: { type: String, required: false },
      youtube: { type: String, required: false },
      tiktok: { type: String, required: false },
    },
    required: false,
    _id: false,
  })
  socialLinks?: {
    instagram?: string;
    youtube?: string;
    tiktok?: string;
  };

  @Prop({ required: true, default: 'ACTEUR' })
  role: string;

  @Prop({ type: String, required: false })
  hashpackAccountId?: string; // Adresse HashPack wallet (format: 0.0.1234567)

  @Prop({
    type: {
      globalScore: { type: Number, default: 0 },
      rank: {
        type: String,
        enum: [
          'AMATEUR',
          'SEMI_PRO',
          'PRO',
          'FAMOUS',
          'STAR',
          'SUPER_STAR',
          'LEGEND',
          'ICON',
        ],
        default: 'AMATEUR',
      },
      averageScore: { type: Number, default: 0 },
      totalSessions: { type: Number, default: 0 },
      totalNFTs: { type: Number, default: 0 },
      maxLevel: { type: Number, default: 0 },
      consistency: { type: Number, default: 0 },
      recentPerformance: { type: Number, default: 0 },
      winStreak: { type: Number, default: 0 },
      globalPosition: { type: Number, default: null },
      percentile: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now },
    },
    required: false,
    _id: false,
  })
  trainingRanking?: {
    globalScore: number;
    rank: string;
    averageScore: number;
    totalSessions: number;
    totalNFTs: number;
    maxLevel: number;
    consistency: number;
    recentPerformance: number;
    winStreak: number;
    globalPosition: number | null;
    percentile: number;
    lastUpdated: Date;
  };

  @Prop({ default: Date.now })
  dateCreation: Date;
}

export const ActeurSchema = SchemaFactory.createForClass(Acteur);

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
  if (Array.isArray(media.gallery)) {
    media.gallery = media.gallery.map((item: any) => ({
      ...item,
      fileId: String(item.fileId),
    }));
  }
};

const transformDocument = (_doc: ActeurDocument, ret: any) => {
  ret.id = String(ret._id);
  delete ret._id;
  if (ret.motDePasse) {
    delete ret.motDePasse;
  }
  transformMedia(ret.media);
  // Transformer les favoris en tableau de strings
  if (Array.isArray(ret.favoris)) {
    ret.favoris = ret.favoris.map((id: any) => String(id));
  }
  return ret;
};

ActeurSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: transformDocument,
});

ActeurSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: transformDocument,
});

