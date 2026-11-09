import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TrainingSession,
  TrainingSessionDocument,
} from './schemas/training-session.schema';
import { NFTReward, NFTRewardDocument } from './schemas/nft-reward.schema';
import { Acteur, ActeurDocument } from '../acteur/schemas/acteur.schema';

export type Rank =
  | 'AMATEUR'
  | 'SEMI_PRO'
  | 'PRO'
  | 'FAMOUS'
  | 'STAR'
  | 'SUPER_STAR'
  | 'LEGEND'
  | 'ICON';

interface RankThreshold {
  min: number;
  max: number;
}

const RANK_THRESHOLDS: Record<Rank, RankThreshold> = {
  AMATEUR: { min: 0, max: 999 },
  SEMI_PRO: { min: 1000, max: 2499 },
  PRO: { min: 2500, max: 4999 },
  FAMOUS: { min: 5000, max: 7499 },
  STAR: { min: 7500, max: 8999 },
  SUPER_STAR: { min: 9000, max: 9499 },
  LEGEND: { min: 9500, max: 9899 },
  ICON: { min: 9900, max: Infinity },
};

@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(
    @InjectModel(TrainingSession.name)
    private trainingSessionModel: Model<TrainingSessionDocument>,
    @InjectModel(NFTReward.name)
    private nftRewardModel: Model<NFTRewardDocument>,
    @InjectModel(Acteur.name)
    private acteurModel: Model<ActeurDocument>,
  ) {}

  /**
   * Calcule le score global composite pour un acteur
   */
  async calculateActorRanking(acteurId: string): Promise<{
    globalScore: number;
    rank: Rank;
    averageScore: number;
    totalSessions: number;
    totalNFTs: number;
    maxLevel: number;
    consistency: number;
    recentPerformance: number;
    winStreak: number;
  }> {
    // Récupérer toutes les sessions de l'acteur
    const sessions = await this.trainingSessionModel
      .find({ acteurId: new Types.ObjectId(acteurId) })
      .sort({ completedAt: -1 })
      .exec();

    if (sessions.length === 0) {
      // Retourner des valeurs par défaut si aucune session
      return {
        globalScore: 0,
        rank: 'AMATEUR',
        averageScore: 0,
        totalSessions: 0,
        totalNFTs: 0,
        maxLevel: 0,
        consistency: 0,
        recentPerformance: 0,
        winStreak: 0,
      };
    }

    // Métriques de base
    const totalSessions = sessions.length;
    const scores = sessions.map((s) => s.globalScore);
    const averageScore = scores.reduce((a, b) => a + b, 0) / totalSessions;
    const maxLevel = Math.max(...sessions.map((s) => s.niveau));

    // Compter les NFTs (sessions avec score >= 70)
    const totalNFTs = sessions.filter((s) => s.nftRewarded).length;

    // Calculer la consistance (inverse de l'écart-type)
    const variance =
      scores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) /
      totalSessions;
    const standardDeviation = Math.sqrt(variance);
    // Consistance = 100 - (écart-type normalisé), avec un minimum de 0
    const consistency = Math.max(0, 100 - standardDeviation);

    // Performance récente (10 dernières sessions)
    const recentSessions = sessions.slice(0, 10);
    const recentPerformance =
      recentSessions.length > 0
        ? recentSessions.reduce((sum, s) => sum + s.globalScore, 0) /
          recentSessions.length
        : 0;

    // Calculer la série de victoires (sessions consécutives >= 70)
    let winStreak = 0;
    for (const session of sessions) {
      if (session.globalScore >= 70) {
        winStreak++;
      } else {
        break; // Arrêter à la première défaite
      }
    }

    // Calculer le score global composite
    const globalScore =
      averageScore * 0.4 + // 40% : Performance moyenne
      maxLevel * 100 * 0.2 + // 20% : Niveau maximum
      totalNFTs * 50 * 0.15 + // 15% : Réussites (NFTs)
      consistency * 0.15 + // 15% : Consistance
      recentPerformance * 0.1 + // 10% : Performance récente
      winStreak * 10; // Bonus : Série de victoires

    // Déterminer le rang
    const rank = this.getRankFromScore(globalScore);

    return {
      globalScore: Math.round(globalScore),
      rank,
      averageScore: Math.round(averageScore * 100) / 100,
      totalSessions,
      totalNFTs,
      maxLevel,
      consistency: Math.round(consistency * 100) / 100,
      recentPerformance: Math.round(recentPerformance * 100) / 100,
      winStreak,
    };
  }

  /**
   * Détermine le rang à partir du score global
   */
  private getRankFromScore(score: number): Rank {
    for (const [rank, threshold] of Object.entries(RANK_THRESHOLDS)) {
      if (score >= threshold.min && score <= threshold.max) {
        return rank as Rank;
      }
    }
    return 'AMATEUR'; // Par défaut
  }

  /**
   * Met à jour le classement d'un acteur
   */
  async updateActorRanking(acteurId: string): Promise<void> {
    const ranking = await this.calculateActorRanking(acteurId);

    // Calculer la position globale et le percentile
    const { globalPosition, percentile } =
      await this.calculateGlobalPosition(acteurId, ranking.globalScore);

    // Mettre à jour l'acteur
    await this.acteurModel.findByIdAndUpdate(acteurId, {
      $set: {
        trainingRanking: {
          ...ranking,
          globalPosition,
          percentile,
          lastUpdated: new Date(),
        },
      },
    });

    this.logger.log(
      `✅ Ranking updated for acteur ${acteurId}: ${ranking.rank} (Score: ${ranking.globalScore})`,
    );
  }

  /**
   * Calcule la position globale et le percentile d'un acteur
   */
  async calculateGlobalPosition(
    acteurId: string,
    globalScore: number,
  ): Promise<{ globalPosition: number | null; percentile: number }> {
    // Compter le nombre d'acteurs avec un score supérieur
    const actorsWithHigherScore = await this.acteurModel.countDocuments({
      _id: { $ne: new Types.ObjectId(acteurId) },
      'trainingRanking.globalScore': { $gt: globalScore },
    });

    // Compter le nombre total d'acteurs avec un classement
    const totalActorsWithRanking = await this.acteurModel.countDocuments({
      'trainingRanking.globalScore': { $exists: true, $gt: 0 },
    });

    if (totalActorsWithRanking === 0) {
      return { globalPosition: 1, percentile: 100 };
    }

    const globalPosition = actorsWithHigherScore + 1;
    const percentile = Math.round(
      ((totalActorsWithRanking - actorsWithHigherScore) / totalActorsWithRanking) *
        100,
    );

    return { globalPosition, percentile };
  }

  /**
   * Récupère le classement d'un acteur
   */
  async getActorRanking(acteurId: string) {
    const acteur = await this.acteurModel.findById(acteurId).exec();

    if (!acteur) {
      throw new NotFoundException('Acteur non trouvé');
    }

    // Si le classement n'existe pas ou est obsolète, le recalculer
    if (
      !acteur.trainingRanking ||
      !acteur.trainingRanking.lastUpdated ||
      Date.now() - acteur.trainingRanking.lastUpdated.getTime() > 3600000 // 1 heure
    ) {
      await this.updateActorRanking(acteurId);
      // Recharger l'acteur après mise à jour
      const updatedActeur = await this.acteurModel.findById(acteurId).exec();
      return updatedActeur?.trainingRanking;
    }

    return acteur.trainingRanking;
  }

  /**
   * Récupère le leaderboard global
   */
  async getLeaderboard(
    page: number = 1,
    limit: number = 50,
  ): Promise<{
    actors: Array<{
      acteurId: string;
      nom: string;
      prenom: string;
      ranking: any;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    // Récupérer les acteurs triés par score global décroissant
    const actors = await this.acteurModel
      .find({
        'trainingRanking.globalScore': { $exists: true, $gt: 0 },
      })
      .select('nom prenom trainingRanking')
      .sort({ 'trainingRanking.globalScore': -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.acteurModel.countDocuments({
      'trainingRanking.globalScore': { $exists: true, $gt: 0 },
    });

    return {
      actors: actors.map((actor) => ({
        acteurId: String(actor._id),
        nom: actor.nom,
        prenom: actor.prenom,
        ranking: actor.trainingRanking,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Met à jour tous les classements (pour maintenance)
   */
  async updateAllRankings(): Promise<void> {
    this.logger.log('🔄 Starting global ranking update...');

    const actors = await this.acteurModel
      .find({})
      .select('_id')
      .exec();

    let updated = 0;
    for (const actor of actors) {
      try {
        await this.updateActorRanking(String(actor._id));
        updated++;
      } catch (error) {
        this.logger.error(
          `Failed to update ranking for actor ${actor._id}:`,
          error,
        );
      }
    }

    this.logger.log(`✅ Updated rankings for ${updated}/${actors.length} actors`);
  }
}

