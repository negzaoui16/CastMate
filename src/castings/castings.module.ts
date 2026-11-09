import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { CastingsService } from './castings.service';
import { CastingsController } from './castings.controller';
import { Casting, CastingSchema } from './schemas/casting.schema';
import { MediaModule } from '../media/media.module';
import { ActeurModule } from '../acteur/acteur.module';
import { AgenceModule } from '../agence/agence.module';
import { InterviewsModule } from '../interviews/interviews.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Casting.name, schema: CastingSchema },
    ]),
    ConfigModule,
    MediaModule,
    ActeurModule,
    AgenceModule,
    InterviewsModule,
  ],
  controllers: [CastingsController],
  providers: [CastingsService],
})
export class CastingsModule {}
