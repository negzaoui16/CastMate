import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NFTRewardDocument = NFTReward & Document;

@Schema({ timestamps: true })
export class NFTReward {
  @Prop({ type: Types.ObjectId, ref: 'Acteur', required: true })
  acteurId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'TrainingSession', required: true })
  trainingSessionId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  niveau: number;

  @Prop({ required: true, min: 70 })
  score: number;

  // Hedera Network
  @Prop({ required: true })
  tokenId: string; // Token ID sur Hedera (unique seulement pour les vrais NFTs)

  @Prop({ required: true })
  serialNumber: string; // Serial number du NFT

  @Prop({ required: true })
  transactionId: string; // Transaction ID sur Hedera

  @Prop({ required: true })
  imageUrl: string; // URL de l'image de la carte NFT

  @Prop({ required: true })
  metadataUrl: string; // URL des métadonnées JSON

  @Prop({ type: String, enum: ['PENDING', 'MINTED', 'FAILED'], default: 'PENDING' })
  status: 'PENDING' | 'MINTED' | 'FAILED';

  @Prop({ type: Date, default: Date.now })
  mintedAt: Date;
}

export const NFTRewardSchema = SchemaFactory.createForClass(NFTReward);

NFTRewardSchema.index({ acteurId: 1, mintedAt: -1 });
NFTRewardSchema.index({ tokenId: 1 });

// Transform pour toJSON
NFTRewardSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc: NFTRewardDocument, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    if (ret.acteurId) {
      ret.acteurId = String(ret.acteurId);
    }
    // Gérer trainingSessionId : si c'est un objet (peuplé), le formater, sinon créer un objet minimal avec id
    if (ret.trainingSessionId) {
      // Vérifier si c'est un objet peuplé (a des propriétés autres que _id ou est un document Mongoose)
      if (
        typeof ret.trainingSessionId === 'object' &&
        !(ret.trainingSessionId instanceof Types.ObjectId) &&
        (ret.trainingSessionId._id || ret.trainingSessionId.id || ret.trainingSessionId.niveau)
      ) {
        // Objet peuplé : formater correctement
        const trainingSession = ret.trainingSessionId;
        ret.trainingSessionId = {
          id: String(trainingSession._id || trainingSession.id),
          _id: String(trainingSession._id || trainingSession.id),
          niveau: trainingSession.niveau,
          globalScore: trainingSession.globalScore,
        };
      } else {
        // ObjectId non peuplé : créer un objet minimal
        ret.trainingSessionId = {
          id: String(ret.trainingSessionId),
        };
      }
    } else {
      ret.trainingSessionId = null;
    }
    return ret;
  },
});

