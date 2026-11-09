import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CastingDocument = Casting & Document;

@Schema({ timestamps: true })
export class Casting {
  @Prop({ required: true })
  titre: string;

  @Prop({ required: true })
  descriptionRole: string;

  @Prop({ required: true })
  synopsis: string;

  @Prop({ required: true })
  lieu: string;

  @Prop({ required: true })
  dateDebut: Date;

  @Prop({ required: true })
  dateFin: Date;

  @Prop({ required: true, min: 0 })
  prix: number;

  @Prop({ type: [String], default: [] })
  types: string[];

  @Prop({ required: false })
  age?: string;

  @Prop({ required: true })
  conditions: string;

  @Prop({ required: true, default: true })
  ouvert: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Agence', required: true })
  recruteur: Types.ObjectId;

  @Prop({
    type: [
      {
        _id: false,
        acteurId: { 
          type: Types.ObjectId, 
          ref: 'Acteur', 
          required: false, // ⚠️ Rendre optionnel pour éviter les erreurs de validation avec données corrompues
        },
        statut: {
          type: String,
          enum: ['EN_ATTENTE', 'ACCEPTE', 'REFUSE'],
          default: 'EN_ATTENTE',
          required: true,
        },
        dateCandidature: { type: Date, default: Date.now },
        auditionVideo: {
          type: {
            fileId: { type: Types.ObjectId, required: false },
            mimeType: { type: String, required: false },
            duration: { type: Number, required: false },
            size: { type: Number, required: false },
            uploadedAt: { type: Date, required: false },
          },
          required: false,
          _id: false,
        },
        aiFeedback: {
          type: {
            globalScore: { type: Number, required: false },
            emotions: {
              type: {
                detected: { type: [String], required: false },
                coherence: { type: Number, required: false },
                intensity: { type: Number, required: false },
                comment: { type: String, required: false },
              },
              required: false,
              _id: false,
            },
            posture: {
              type: {
                score: { type: Number, required: false },
                strengths: { type: [String], required: false },
                improvements: { type: [String], required: false },
                comment: { type: String, required: false },
              },
              required: false,
              _id: false,
            },
            intonation: {
              type: {
                score: { type: Number, required: false },
                clarity: { type: Number, required: false },
                rhythm: { type: Number, required: false },
                expressiveness: { type: Number, required: false },
                comment: { type: String, required: false },
              },
              required: false,
              _id: false,
            },
            expressivite: {
              type: {
                score: { type: Number, required: false },
                facialExpressions: { type: String, required: false },
                bodyLanguage: { type: String, required: false },
                comment: { type: String, required: false },
              },
              required: false,
              _id: false,
            },
            recommendations: { type: [String], required: false },
            strengths: { type: [String], required: false },
            summary: { type: String, required: false },
            analyzedAt: { type: Date, required: false },
          },
          required: false,
          _id: false,
        },
      },
    ],
    default: [],
  })
  candidats: {
    acteurId?: Types.ObjectId; // ⚠️ Rendre optionnel dans le type TypeScript aussi
    statut: 'EN_ATTENTE' | 'ACCEPTE' | 'REFUSE';
    dateCandidature: Date;
    auditionVideo?: {
      fileId?: Types.ObjectId;
      mimeType?: string;
      duration?: number;
      size?: number;
      uploadedAt?: Date;
    };
    aiFeedback?: {
      globalScore?: number;
      emotions?: {
        detected?: string[];
        coherence?: number;
        intensity?: number;
        comment?: string;
      };
      posture?: {
        score?: number;
        strengths?: string[];
        improvements?: string[];
        comment?: string;
      };
      intonation?: {
        score?: number;
        clarity?: number;
        rhythm?: number;
        expressiveness?: number;
        comment?: string;
      };
      expressivite?: {
        score?: number;
        facialExpressions?: string;
        bodyLanguage?: string;
        comment?: string;
      };
      recommendations?: string[];
      strengths?: string[];
      summary?: string;
      analyzedAt?: Date;
    };
  }[];

  @Prop({
    type: {
      afficheFileId: { type: Types.ObjectId, required: false },
      afficheMimeType: { type: String, required: false },
      afficheOriginalName: { type: String, required: false },
      afficheLength: { type: Number, required: false },
      afficheUploadDate: { type: Date, required: false },
    },
    required: false,
    _id: false,
    default: undefined,
  })
  media?: {
    afficheFileId?: Types.ObjectId;
    afficheMimeType?: string;
    afficheOriginalName?: string;
    afficheLength?: number;
    afficheUploadDate?: Date;
  };
}

export const CastingSchema = SchemaFactory.createForClass(Casting);

const transformMedia = (media: any) => {
  if (!media) {
    return;
  }

  try {
    if (media.afficheFileId) {
      media.afficheFileId = String(media.afficheFileId);
    }
  } catch (error) {
    // Ignorer les erreurs de transformation du media
    console.warn('Erreur lors de la transformation du media:', error);
  }
};

const transformCandidats = (candidats: any[]) => {
  if (!Array.isArray(candidats)) {
    return;
  }

  try {
    candidats.forEach((candidat: any) => {
      if (candidat.auditionVideo?.fileId) {
        candidat.auditionVideo.fileId = String(candidat.auditionVideo.fileId);
      }
    });
  } catch (error) {
    // Ignorer les erreurs de transformation des candidats
    console.warn('Erreur lors de la transformation des candidats:', error);
  }
};

const transformDocument = (_doc: CastingDocument, ret: any) => {
  try {
    if (ret._id) {
      ret.id = String(ret._id);
      delete ret._id;
    }
    transformMedia(ret.media);
    transformCandidats(ret.candidats);
  } catch (error) {
    // En cas d'erreur, retourner le document tel quel
    console.error('Erreur lors de la transformation du document:', error);
  }
  return ret;
};

CastingSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: transformDocument,
});

CastingSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: transformDocument,
});

