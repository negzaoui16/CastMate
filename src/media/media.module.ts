import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { Casting, CastingSchema } from '../castings/schemas/casting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Casting.name, schema: CastingSchema },
    ]),
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}

