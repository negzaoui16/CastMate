import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TrainingSession,
  TrainingSessionDocument,
} from './schemas/training-session.schema';
import { NFTReward, NFTRewardDocument } from './schemas/nft-reward.schema';
import { SubmitTrainingDto } from './dto/submit-training.dto';
import { NFTService } from './nft/nft.service';
import { ActeurService } from '../acteur/acteur.service';
import { RankingService } from './ranking.service';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    @InjectModel(TrainingSession.name)
    private trainingSessionModel: Model<TrainingSessionDocument>,
    @InjectModel(NFTReward.name)
    private nftRewardModel: Model<NFTRewardDocument>,
    private nftService: NFTService,
    private acteurService: ActeurService,
    private rankingService: RankingService,
  ) {}

  /**
   * Soumet une session d'entraînement et attribue un NFT si le score >= 70
   */
  async submitTraining(
    submitTrainingDto: SubmitTrainingDto,
  ): Promise<{
    session: TrainingSessionDocument;
    nftReward?: NFTRewardDocument;
  }> {
    // Vérifier que l'acteur existe
    const acteur = await this.acteurService.findById(submitTrainingDto.acteurId);
    if (!acteur) {
      throw new NotFoundException('Acteur non trouvé');
    }

    // Créer la session d'entraînement
    const trainingSession = new this.trainingSessionModel({
      acteurId: new Types.ObjectId(submitTrainingDto.acteurId),
      niveau: submitTrainingDto.niveau,
      globalScore: submitTrainingDto.globalScore,
      emotions: submitTrainingDto.emotions,
      strengths: submitTrainingDto.strengths,
      recommendations: submitTrainingDto.recommendations,
      completedAt: new Date(),
    });

    await trainingSession.save();

    let nftReward: NFTRewardDocument | undefined;

    // Si le score >= 70, créer un NFT
    if (submitTrainingDto.globalScore >= 70) {
      try {
        const acteurName = `${acteur.prenom} ${acteur.nom}`;

        // Mint le NFT sur Hedera
        const nftData = await this.nftService.mintTrainingNFT(
          submitTrainingDto.acteurId,
          acteurName,
          submitTrainingDto.niveau,
          submitTrainingDto.globalScore,
        );

        // Créer l'enregistrement NFT dans la base de données
        nftReward = new this.nftRewardModel({
          acteurId: new Types.ObjectId(submitTrainingDto.acteurId),
          trainingSessionId: trainingSession._id,
          niveau: submitTrainingDto.niveau,
          score: submitTrainingDto.globalScore,
          tokenId: nftData.tokenId,
          serialNumber: nftData.serialNumber,
          transactionId: nftData.transactionId,
          imageUrl: nftData.imageUrl,
          metadataUrl: nftData.metadataUrl,
          status: 'MINTED',
          mintedAt: new Date(),
        });

        await nftReward.save();

        // Mettre à jour la session avec le NFT
        trainingSession.nftRewarded = true;
        trainingSession.nftRewardId = nftReward._id as Types.ObjectId;
        await trainingSession.save();

        this.logger.log(
          `NFT reward created for acteur ${submitTrainingDto.acteurId} - Level ${submitTrainingDto.niveau} - Score ${submitTrainingDto.globalScore}`,
        );

        // Transférer automatiquement le NFT à l'utilisateur s'il a un compte HashPack
        if (acteur.hashpackAccountId) {
          try {
            // Vérifier que ce n'est pas un NFT mock (ne pas transférer les NFTs mock)
            if (!nftData.tokenId.startsWith('MOCK_')) {
              const transferTxId = await this.nftService.transferNFTToUser(
                nftData.tokenId,
                nftData.serialNumber,
                acteur.hashpackAccountId,
              );
              this.logger.log(
                `✅ NFT automatically transferred to HashPack account ${acteur.hashpackAccountId}`,
              );
              this.logger.log(`   Transfer Transaction ID: ${transferTxId}`);
            } else {
              this.logger.log(
                `⚠️ NFT is mock (${nftData.tokenId}), skipping automatic transfer`,
              );
            }
          } catch (transferError) {
            this.logger.error(
              `Failed to automatically transfer NFT to HashPack: ${transferError instanceof Error ? transferError.message : 'Unknown error'}`,
            );
            // Ne pas faire échouer la création du NFT si le transfert échoue
            // L'utilisateur pourra toujours transférer manuellement plus tard
          }
        } else {
          this.logger.log(
            `ℹ️ Acteur ${submitTrainingDto.acteurId} does not have HashPack account, NFT will remain in treasury`,
          );
        }
      } catch (error) {
        this.logger.error('Error creating NFT reward:', error);
        if (error instanceof Error) {
          this.logger.error('Error message:', error.message);
          this.logger.error('Error stack:', error.stack);
        }
        // Ne pas faire échouer la création de la session si le NFT échoue
        // On continue sans NFT mais on log l'erreur
      }
    }

    // Populate les références avant de retourner
    await trainingSession.populate('nftRewardId');
    if (nftReward) {
      await nftReward.populate('trainingSessionId');
    }

    // Mettre à jour le classement de l'acteur (de manière asynchrone pour ne pas bloquer)
    this.rankingService
      .updateActorRanking(submitTrainingDto.acteurId)
      .catch((error) => {
        this.logger.error(
          `Failed to update ranking for actor ${submitTrainingDto.acteurId}:`,
          error,
        );
      });

    return {
      session: trainingSession,
      nftReward,
    };
  }

  /**
   * Récupère les métadonnées complètes d'un NFT au format standard (ERC-721 compatible)
   */
  async getNFTMetadata(
    tokenId: string,
    serialNumber: string,
  ): Promise<any> {
    const nftReward = await this.nftRewardModel.findOne({
      tokenId,
      serialNumber,
    });

    if (!nftReward) {
      throw new NotFoundException(
        `NFT non trouvé pour Token ID: ${tokenId}, Serial: ${serialNumber}`,
      );
    }

    // Retourner les métadonnées au format standard NFT (ERC-721 compatible)
    return {
      name: `CastMate Training Card - Niveau ${nftReward.niveau}`,
      description: `Carte NFT obtenue après avoir complété le niveau ${nftReward.niveau} avec un score de ${nftReward.score}%`,
      image: nftReward.imageUrl, // URL de l'image sur Hedera File Service ou locale
      external_url: nftReward.metadataUrl, // URL des métadonnées complètes
      attributes: [
        {
          trait_type: 'Niveau',
          value: nftReward.niveau,
        },
        {
          trait_type: 'Score',
          value: nftReward.score,
        },
        {
          trait_type: 'Token ID',
          value: nftReward.tokenId,
        },
        {
          trait_type: 'Serial Number',
          value: nftReward.serialNumber,
        },
        {
          trait_type: 'Plateforme',
          value: 'CastMate',
        },
      ],
    };
  }

  /**
   * Récupère toutes les sessions d'entraînement d'un acteur
   */
  async getActorTrainingSessions(
    acteurId: string,
  ): Promise<TrainingSessionDocument[]> {
    return this.trainingSessionModel
      .find({ acteurId: new Types.ObjectId(acteurId) })
      .sort({ completedAt: -1 })
      .populate('nftRewardId')
      .exec();
  }

  /**
   * Récupère tous les NFTs d'un acteur
   */
  async getActorNFTs(acteurId: string): Promise<NFTRewardDocument[]> {
    return this.nftRewardModel
      .find({ acteurId: new Types.ObjectId(acteurId) })
      .sort({ mintedAt: -1 })
      .populate('trainingSessionId')
      .exec();
  }

  /**
   * Récupère une session d'entraînement par ID
   */
  async getTrainingSession(
    sessionId: string,
  ): Promise<TrainingSessionDocument> {
    const session = await this.trainingSessionModel
      .findById(sessionId)
      .populate('nftRewardId')
      .exec();

    if (!session) {
      throw new NotFoundException('Session d\'entraînement non trouvée');
    }

    return session;
  }

  /**
   * Récupère un NFT par ID
   */
  async getNFTReward(nftId: string): Promise<NFTRewardDocument> {
    const nft = await this.nftRewardModel.findById(nftId).exec();

    if (!nft) {
      throw new NotFoundException('NFT non trouvé');
    }

    return nft;
  }
}

