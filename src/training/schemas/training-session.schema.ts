import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TrainingSessionDocument = TrainingSession & Document;

@Schema({ timestamps: true })
export class TrainingSession {
  @Prop({ type: Types.ObjectId, ref: 'Acteur', required: true })
  acteurId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  niveau: number;

  @Prop({ required: true, min: 0, max: 100 })
  globalScore: number;

  @Prop({
    type: {
      detected: { type: [String], required: true },
      coherence: { type: Number, required: true, min: 0, max: 100 },
      intensity: { type: Number, required: true, min: 0, max: 100 },
    },
    required: true,
    _id: false,
  })
  emotions: {
    detected: string[];
    coherence: number;
    intensity: number;
  };

  @Prop({ type: [String], default: [] })
  strengths: string[];

  @Prop({ type: [String], default: [] })
  recommendations: string[];

  @Prop({ type: Boolean, default: false })
  nftRewarded: boolean;

  @Prop({ type: Types.ObjectId, ref: 'NFTReward', required: false })
  nftRewardId?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  completedAt: Date;
}

export const TrainingSessionSchema = SchemaFactory.createForClass(TrainingSession);

// Index pour améliorer les performances
TrainingSessionSchema.index({ acteurId: 1, niveau: 1 });
TrainingSessionSchema.index({ acteurId: 1, completedAt: -1 });

// Transform pour toJSON
TrainingSessionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc: TrainingSessionDocument, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    if (ret.acteurId) {
      ret.acteurId = String(ret.acteurId);
    }
    // Gérer nftRewardId : si c'est un objet (peuplé), le formater, sinon créer un objet minimal avec id
    if (ret.nftRewardId) {
      // Vérifier si c'est un objet peuplé (a des propriétés autres que _id ou est un document Mongoose)
      if (
        typeof ret.nftRewardId === 'object' &&
        !(ret.nftRewardId instanceof Types.ObjectId) &&
        (ret.nftRewardId._id || ret.nftRewardId.id || ret.nftRewardId.tokenId)
      ) {
        // Objet peuplé : formater correctement
        const nftReward = ret.nftRewardId;
        ret.nftRewardId = {
          id: String(nftReward._id || nftReward.id),
          _id: String(nftReward._id || nftReward.id),
          tokenId: nftReward.tokenId,
          serialNumber: nftReward.serialNumber,
          imageUrl: nftReward.imageUrl,
        };
      } else {
        // ObjectId non peuplé : créer un objet minimal
        ret.nftRewardId = {
          id: String(ret.nftRewardId),
        };
      }
    } else {
      ret.nftRewardId = null;
    }
    return ret;
  },
});

