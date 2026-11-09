import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { RankingService } from './ranking.service';
import {
  TrainingSession,
  TrainingSessionSchema,
} from './schemas/training-session.schema';
import { NFTReward, NFTRewardSchema } from './schemas/nft-reward.schema';
import { HederaService } from './nft/hedera.service';
import { NFTService } from './nft/nft.service';
import { ActeurModule } from '../acteur/acteur.module';
import { MediaModule } from '../media/media.module';
import { Acteur, ActeurSchema } from '../acteur/schemas/acteur.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrainingSession.name, schema: TrainingSessionSchema },
      { name: NFTReward.name, schema: NFTRewardSchema },
      { name: Acteur.name, schema: ActeurSchema },
    ]),
    ActeurModule,
    MediaModule, // Pour utiliser GridFS pour stocker les images NFT
  ],
  controllers: [TrainingController],
  providers: [TrainingService, RankingService, HederaService, NFTService],
  exports: [TrainingService, RankingService],
})
export class TrainingModule {}

