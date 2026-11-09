import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgenceController } from './agence.controller';
import { AgenceService } from './agence.service';
import { Agence, AgenceSchema } from './schemas/agence.schema';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Agence.name, schema: AgenceSchema }]),
    MediaModule,
  ],
  controllers: [AgenceController],
  providers: [AgenceService],
  exports: [AgenceService],
})
export class AgenceModule {}

