import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InterviewDocument = Interview & Document;

@Schema({ timestamps: true })
export class Interview {
  @Prop({ type: Types.ObjectId, ref: 'Casting', required: true })
  castingId: Types.ObjectId;

  @Prop({ type: String, required: true })
  castingTitle: string;

  @Prop({ type: Types.ObjectId, ref: 'Acteur', required: true })
  acteurId: Types.ObjectId;

  @Prop({ type: String, required: true })
  acteurName: string;

  @Prop({ type: Types.ObjectId, ref: 'Agence', required: true })
  agenceId: Types.ObjectId;

  @Prop({ type: String, required: true })
  agenceName: string;

  @Prop({
    type: [
      {
        date: { type: String, required: true },
        time: { type: String, required: false },
        isSelected: { type: Boolean, default: false },
        _id: false,
      },
    ],
    required: true,
    validate: {
      validator: function (v: any[]) {
        return v && v.length === 3;
      },
      message: 'Vous devez proposer exactement 3 dates d\'interview',
    },
  })
  proposedDates: Array<{
    date: string;
    time?: string;
    isSelected: boolean;
  }>;

  @Prop({ type: String, required: false })
  selectedDate?: string;

  @Prop({ type: String, required: false })
  selectedTime?: string;

  @Prop({
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
    default: 'PENDING',
  })
  status: string;
}

export const InterviewSchema = SchemaFactory.createForClass(Interview);

// Index pour les requêtes fréquentes
InterviewSchema.index({ acteurId: 1, status: 1 });
InterviewSchema.index({ agenceId: 1, status: 1 });
InterviewSchema.index({ castingId: 1 });

// Transformation pour le JSON
const transformDocument = (_doc: InterviewDocument, ret: any) => {
  ret.id = String(ret._id);
  delete ret._id;
  if (ret.castingId) {
    ret.castingId = String(ret.castingId);
  }
  if (ret.acteurId) {
    ret.acteurId = String(ret.acteurId);
  }
  if (ret.agenceId) {
    ret.agenceId = String(ret.agenceId);
  }
  return ret;
};

InterviewSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: transformDocument,
});

InterviewSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: transformDocument,
});

