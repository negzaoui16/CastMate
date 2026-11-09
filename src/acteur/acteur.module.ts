import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActeurController } from './acteur.controller';
import { ActeurService } from './acteur.service';
import { Acteur, ActeurSchema } from './schemas/acteur.schema';
import { Casting, CastingSchema } from '../castings/schemas/casting.schema';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Acteur.name, schema: ActeurSchema },
      { name: Casting.name, schema: CastingSchema },
    ]),
    MediaModule,
  ],
  controllers: [ActeurController],
  providers: [ActeurService],
  exports: [ActeurService],
})
export class ActeurModule {}

