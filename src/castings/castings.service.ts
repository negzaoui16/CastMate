import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Casting, CastingDocument } from './schemas/casting.schema';
import { CreateCastingDto } from './dto/create-casting.dto';
import { UpdateCastingDto } from './dto/update-casting.dto';
import { ApplyToCastingDto } from './dto/apply-to-casting.dto';
import { Role } from '../common/enums/role.enum';
import { MediaService, CastingMediaMetadata } from '../media/media.service';
import { ActeurService } from '../acteur/acteur.service';
import { AgenceService } from '../agence/agence.service';
import { InterviewsService } from '../interviews/interviews.service';
import { AcceptCandidateWithInterviewDto } from '../interviews/dto/accept-candidate-with-interview.dto';
import type { Express } from 'express';
import type { Response } from 'express';
import { StreamableFile } from '@nestjs/common';

@Injectable()
export class CastingsService {
  private readonly baseUrl: string;

  constructor(
    @InjectModel(Casting.name) private castingModel: Model<CastingDocument>,
    private readonly mediaService: MediaService,
    private readonly acteurService: ActeurService,
    private readonly agenceService: AgenceService,
    private readonly interviewsService: InterviewsService,
    private readonly configService: ConfigService,
  ) {
    // Priorité : PRODUCTION_URL > API_BASE_URL > localhost
    this.baseUrl =
      this.configService.get<string>('PRODUCTION_URL') ||
      this.configService.get<string>('API_BASE_URL') ||
      'http://localhost:3000';
  }

  /**
   * Normalise une URL pour utiliser l'URL de production au lieu de localhost
   * @param url - L'URL à normaliser
   * @returns L'URL normalisée
   */
  private normalizeUrl(url: string): string {
    if (!url) {
      return url;
    }

    // Remplacer localhost par l'URL de production
    const normalizedUrl = url
      .replace(/http:\/\/localhost:3000/g, this.baseUrl)
      .replace(/http:\/\/127\.0\.0\.1:3000/g, this.baseUrl)
      .replace(/https:\/\/localhost:3000/g, this.baseUrl)
      .replace(/https:\/\/127\.0\.0\.1:3000/g, this.baseUrl);

    return normalizedUrl;
  }

  /**
   * Transforme un casting pour ajouter les URLs des images
   * @param casting - Le casting à transformer
   * @returns Le casting avec les URLs d'images ajoutées
   */
  private transformCasting(casting: any): any {
    if (!casting) {
      return casting;
    }

    // Ajouter l'URL de l'affiche si elle existe
    if (casting.media?.afficheFileId) {
      const afficheFileId = String(casting.media.afficheFileId);
      // Générer l'URL avec la base URL de production
      casting.media.afficheUrl = `${this.baseUrl}/media/${afficheFileId}`;
      // Convertir aussi le fileId en string pour cohérence
      casting.media.afficheFileId = afficheFileId;
    }

    // Normaliser l'URL existante si elle contient localhost (pour les castings créés avant le fix)
    if (casting.media?.afficheUrl) {
      casting.media.afficheUrl = this.normalizeUrl(casting.media.afficheUrl);
    }

    return casting;
  }

  /**
   * Transforme un tableau de castings pour ajouter les URLs des images
   * @param castings - Le tableau de castings à transformer
   * @returns Le tableau de castings avec les URLs d'images ajoutées
   */
  private transformCastings(castings: any[]): any[] {
    if (!Array.isArray(castings)) {
      return castings;
    }

    return castings.map((casting) => this.transformCasting(casting));
  }

  /**
   * Crée un nouveau casting dans la base de données
   * 
   * Fonctionnement :
   * 1. Génère un ID unique pour le casting
   * 2. Si une affiche est fournie, l'upload dans GridFS (stockage de fichiers MongoDB)
   * 3. Vérifie si le casting est déjà expiré (date de fin passée)
   * 4. Crée le document casting dans la base de données avec toutes les informations
   * 5. Sauvegarde le casting
   * 6. Récupère le casting avec les informations complètes du recruteur (agence)
   * 7. Retourne le casting avec les URLs des images transformées
   * 
   * @param createCastingDto - Les données du casting à créer (titre, description, dates, prix, etc.)
   * @param recruteurId - L'ID de l'agence qui crée le casting (ex: "507f1f77bcf86cd799439011")
   * @param ownerRole - Le rôle du créateur (toujours "RECRUTEUR" pour les agences)
   * @param affiche - Optionnel : Le fichier image de l'affiche du casting (JPEG ou PNG)
   * @returns Le casting créé avec toutes les informations complètes
   * 
   * Exemple :
   * Input: 
   *   createCastingDto = {
   *     titre: "Recherche acteur principal",
   *     descriptionRole: "Rôle masculin 30-40 ans",
   *     synopsis: "Série dramatique...",
   *     lieu: "Paris",
   *     dateDebut: "2024-01-15",
   *     dateFin: "2024-02-15",
   *     prix: 5000,
   *     conditions: "Disponibilité totale"
   *   }
   *   recruteurId = "507f1f77bcf86cd799439011"
   *   affiche = File (image JPEG)
   * 
   * Output: {
   *   id: "507f1f77bcf86cd799439012",
   *   titre: "Recherche acteur principal",
   *   recruteur: { nomAgence: "Agence Paris", email: "agence@example.com", ... },
   *   media: { afficheUrl: "https://api.example.com/media/123", ... }
   * }
   */
  async create(
    createCastingDto: CreateCastingDto, // Les données du casting (titre, description, dates, etc.)
    recruteurId: string, // L'ID de l'agence qui crée le casting
    ownerRole: Role, // Le rôle (RECRUTEUR)
    affiche?: Express.Multer.File, // Optionnel : fichier image de l'affiche
  ) {
    // ÉTAPE 1 : Générer un ID unique pour le nouveau casting
    // Types.ObjectId() génère un identifiant unique MongoDB
    // Exemple : new Types.ObjectId() → ObjectId("507f1f77bcf86cd799439012")
    const castingId = new Types.ObjectId();
    
    // ÉTAPE 2 : Convertir l'ID du recruteur en ObjectId
    // recruteurId est une string (ex: "507f1f77bcf86cd799439011")
    // On la convertit en ObjectId pour pouvoir l'utiliser dans MongoDB
    const recruteurObjectId = new Types.ObjectId(recruteurId);
    
    // ÉTAPE 3 : Initialiser la variable pour stocker les métadonnées de l'affiche
    // Si une affiche est uploadée, cette variable contiendra les infos (fileId, URL, etc.)
    let poster: CastingMediaMetadata | undefined;

    // On utilise try/catch pour gérer les erreurs
    // Si une erreur se produit, on supprime l'affiche uploadée pour ne pas laisser de fichiers orphelins
    try {
      // ÉTAPE 4 : Uploader l'affiche si elle est fournie
      // Si l'utilisateur a fourni une image, on l'upload dans GridFS (stockage de fichiers MongoDB)
      // 
      // Exemple :
      //   affiche = File { originalname: "affiche.jpg", mimetype: "image/jpeg", buffer: [...] }
      //   On upload dans GridFS et on récupère :
      //   poster = { afficheFileId: ObjectId("123"), afficheMimeType: "image/jpeg", afficheUrl: "..." }
      if (affiche) {
        poster = await this.mediaService.storeCastingAffiche({
          castingId, // ID du casting (pour lier l'affiche au casting)
          ownerId: recruteurObjectId, // ID de l'agence propriétaire
          ownerRole, // Rôle du propriétaire (RECRUTEUR)
          file: affiche, // Le fichier image à uploader
        });
      }

      // ÉTAPE 5 : Convertir les dates string en objets Date
      // Les dates arrivent en string (ex: "2024-01-15")
      // On les convertit en objets Date pour pouvoir les comparer et les utiliser
      const dateFin = new Date(createCastingDto.dateFin);
      const now = new Date(); // Date actuelle
      
      // ÉTAPE 6 : Vérifier si le casting est déjà expiré
      // Si la date de fin est dans le passé, le casting doit être fermé automatiquement
      // 
      // Exemple :
      //   dateFin = 2024-01-10
      //   maintenant = 2024-01-15
      //   dateFin < maintenant → Casting expiré, on le ferme automatiquement
      const shouldBeOpen = createCastingDto.ouvert ?? true; // Par défaut, le casting est ouvert
      const isExpired = dateFin < now; // Vérifier si la date de fin est passée
      
      // ÉTAPE 7 : Créer le document casting dans MongoDB
      // On crée un nouvel objet avec toutes les données du casting
      // 
      // Structure du document :
      // {
      //   _id: ObjectId("507f1f77bcf86cd799439012"),
      //   titre: "Recherche acteur principal",
      //   descriptionRole: "Rôle masculin 30-40 ans",
      //   synopsis: "Série dramatique...",
      //   lieu: "Paris",
      //   dateDebut: Date("2024-01-15"),
      //   dateFin: Date("2024-02-15"),
      //   prix: 5000,
      //   recruteur: ObjectId("507f1f77bcf86cd799439011"),
      //   candidats: [], // Liste vide au début
      //   ouvert: true, // Ouvert aux candidatures
      //   media: { afficheFileId: ObjectId("123"), ... } // Métadonnées de l'affiche
      // }
      const casting = new this.castingModel({
        _id: castingId, // ID unique du casting
        ...createCastingDto, // Toutes les données du DTO (titre, description, synopsis, lieu, prix, etc.)
        dateDebut: new Date(createCastingDto.dateDebut), // Convertir la date de début en Date
        dateFin: dateFin, // Date de fin (déjà convertie)
        recruteur: recruteurObjectId, // ID de l'agence qui crée le casting
        candidats: [], // Liste vide de candidats au début
        ouvert: shouldBeOpen && !isExpired, // Ouvrir seulement si demandé ET non expiré
        media: poster, // Métadonnées de l'affiche (si uploadée)
      });
      
      // ÉTAPE 8 : Sauvegarder le casting dans la base de données
      // .save() écrit le document dans la collection "castings" de MongoDB
      await casting.save();

      // ÉTAPE 9 : Récupérer le casting avec les informations complètes du recruteur
      // Par défaut, MongoDB stocke seulement l'ID du recruteur (ObjectId)
      // .populate() remplace l'ID par les informations complètes de l'agence
      // 
      // Avant populate :
      //   recruteur: ObjectId("507f1f77bcf86cd799439011")
      // 
      // Après populate :
      //   recruteur: {
      //     nomAgence: "Agence de Casting Paris",
      //     responsable: "Jean Dupont",
      //     email: "agence@example.com",
      //     tel: "0123456789",
      //     ...
      //   }
      const populatedCasting = await this.castingModel
        .findById(castingId) // Trouver le casting par son ID
        .populate({
          path: 'recruteur', // Le champ à peupler (remplacer l'ID par l'objet complet)
          select: 'nomAgence responsable email tel gouvernorat siteWeb description socialLinks media', // Les champs à récupérer
        })
        .lean() // Convertir en objet JavaScript pur (plus rapide, pas de méthodes Mongoose)
        .exec(); // Exécuter la requête

      // ÉTAPE 10 : Vérifier que le casting a bien été trouvé
      // Normalement, il devrait toujours exister car on vient de le créer
      // Mais c'est une sécurité au cas où
      if (!populatedCasting) {
        throw new NotFoundException('Casting créé mais non trouvé après création');
      }

      // ÉTAPE 11 : Transformer le casting et retourner le résultat
      // transformCasting() ajoute les URLs complètes des images
      // Exemple : afficheFileId → afficheUrl: "https://api.example.com/media/123"
      return this.transformCasting(populatedCasting);
    } catch (error) {
      // En cas d'erreur, supprimer l'affiche uploadée pour ne pas laisser de fichiers orphelins
      // Si l'affiche a été uploadée mais que la création du casting a échoué,
      // on supprime l'affiche pour ne pas gaspiller de l'espace de stockage
      if (poster?.afficheFileId) {
        await this.mediaService.deleteMany([poster.afficheFileId]);
      }
      // Relancer l'erreur pour que le controller puisse la gérer
      throw error;
    }
  }

  // Méthode privée pour fermer automatiquement les castings expirés
  private async closeExpiredCastings() {
    const now = new Date();
    const result = await this.castingModel
      .updateMany(
        {
          ouvert: true,
          dateFin: { $lt: now },
        },
        {
          $set: { ouvert: false },
        },
      )
      .exec();
    return result.modifiedCount;
  }

  async findAll() {
    // Fermer automatiquement les castings expirés
    await this.closeExpiredCastings();
    
    const castings = await this.castingModel
      .find()
      .populate({
        path: 'recruteur',
        select: 'nomAgence responsable email tel gouvernorat siteWeb description socialLinks media',
      })
      .populate({
        path: 'candidats.acteurId',
        select: 'nom prenom email media',
        // Ignorer les erreurs si certains candidats n'ont pas la structure attendue
        options: { strictPopulate: false },
      })
      .lean() // Utiliser .lean() pour éviter la validation Mongoose
      .exec();
    
    // Filtrer les candidats invalides pour chaque casting et transformer
    return this.transformCastings(
      castings.map((casting: any) => {
        if (casting.candidats && Array.isArray(casting.candidats)) {
          casting.candidats = casting.candidats.filter(
            (candidat: any) => candidat.acteurId != null && candidat.acteurId !== undefined
          );
        }
        return casting;
      })
    );
  }

  async findOne(id: string) {
    try {
      // Fermer automatiquement les castings expirés
      await this.closeExpiredCastings();
      
      // Utiliser .lean() pour éviter la validation Mongoose et obtenir un objet JavaScript pur
      const casting = await this.castingModel
        .findById(id)
        .populate({
          path: 'recruteur',
          select: 'nomAgence responsable email media',
        })
        .populate({
          path: 'candidats.acteurId',
          select: 'nom prenom email media',
          // Ignorer les erreurs si certains candidats n'ont pas la structure attendue
          options: { strictPopulate: false },
        })
        .lean() // ⚠️ CRITIQUE : Convertit en objet JS pur, évite la validation Mongoose
        .exec();
      
      if (!casting) {
        throw new NotFoundException('Casting non trouvé');
      }
      
      // Filtrer les candidats invalides (sans acteurId)
      if (casting.candidats && Array.isArray(casting.candidats)) {
        casting.candidats = casting.candidats.filter(
          (candidat: any) => candidat.acteurId != null && candidat.acteurId !== undefined
        );
      }
      
      // Vérifier et fermer ce casting spécifique s'il est expiré
      // Note: Avec .lean(), on ne peut pas utiliser .save(), donc on fait une mise à jour directe
      if (casting.ouvert && new Date(casting.dateFin) < new Date()) {
        await this.castingModel.findByIdAndUpdate(
          id,
          { $set: { ouvert: false } },
          { new: false }
        );
        casting.ouvert = false;
      }
      
      return this.transformCasting(casting);
    } catch (error) {
      // Logger l'erreur pour le débogage
      console.error('Erreur dans findOne:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
      console.error('ID utilisé:', id);
      
      // Si c'est déjà une NotFoundException, la relancer
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      // Pour les autres erreurs, logger et relancer
      throw error;
    }
  }

  async update(
    id: string,
    updateCastingDto: UpdateCastingDto,
    userId: string,
    userRole: Role,
    affiche?: Express.Multer.File,
  ) {
    const casting = await this.castingModel.findById(id).exec();
    if (!casting) {
      throw new NotFoundException('Casting non trouvé');
    }

    // Seul le recruteur propriétaire ou un admin peut modifier
    if (
      userRole !== Role.ADMIN &&
      casting.recruteur.toString() !== userId
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres castings',
      );
    }

    let poster: CastingMediaMetadata | undefined;

    try {
      if (typeof updateCastingDto.titre === 'string') {
        casting.titre = updateCastingDto.titre;
      }
      if (typeof updateCastingDto.descriptionRole === 'string') {
        casting.descriptionRole = updateCastingDto.descriptionRole;
      }
      if (typeof updateCastingDto.synopsis === 'string') {
        casting.synopsis = updateCastingDto.synopsis;
      }
      if (typeof updateCastingDto.lieu === 'string') {
        casting.lieu = updateCastingDto.lieu;
      }
      if (Array.isArray(updateCastingDto.types)) {
        casting.types = updateCastingDto.types;
      }
      if (typeof updateCastingDto.age === 'string') {
        casting.age = updateCastingDto.age;
      }
      if (typeof updateCastingDto.conditions === 'string') {
        casting.conditions = updateCastingDto.conditions;
      }
      if (typeof updateCastingDto.prix === 'number') {
        casting.prix = updateCastingDto.prix;
      }
      if (updateCastingDto.dateDebut) {
        casting.dateDebut = new Date(updateCastingDto.dateDebut);
      }
      if (updateCastingDto.dateFin) {
        const newDateFin = new Date(updateCastingDto.dateFin);
        casting.dateFin = newDateFin;
        
        // Si la nouvelle date de fin est passée, fermer automatiquement
        if (newDateFin < new Date()) {
          casting.ouvert = false;
        }
      }
      
      // Traiter ouvert indépendamment de dateFin
      if (typeof updateCastingDto.ouvert === 'boolean') {
        // Si on met à jour le statut ouvert, vérifier quand même la date
        if (updateCastingDto.ouvert && casting.dateFin < new Date()) {
          // Ne pas rouvrir un casting expiré
          casting.ouvert = false;
        } else {
          casting.ouvert = updateCastingDto.ouvert;
        }
      } else if (!updateCastingDto.dateFin) {
        // Vérifier si le casting est expiré seulement si on ne modifie ni dateFin ni ouvert
        if (casting.ouvert && casting.dateFin < new Date()) {
          casting.ouvert = false;
        }
      }

      if (affiche) {
        poster = await this.mediaService.storeCastingAffiche({
          castingId: casting._id as Types.ObjectId,
          ownerId: casting.recruteur as Types.ObjectId,
          ownerRole: userRole,
          file: affiche,
          previousFileId: casting.media?.afficheFileId,
        });
        casting.media = poster;
      }

      await casting.save();

      // Re-récupérer avec .lean() pour éviter la validation et filtrer les candidats invalides
      const updatedCasting = await this.castingModel
        .findById(id)
        .populate({
          path: 'recruteur',
          select: 'nomAgence responsable email media',
        })
        .populate({
          path: 'candidats.acteurId',
          select: 'nom prenom email media',
          options: { strictPopulate: false },
        })
        .lean()
        .exec();

      if (!updatedCasting) {
        throw new NotFoundException('Casting non trouvé après mise à jour');
      }

      // Filtrer les candidats invalides
      if (updatedCasting.candidats && Array.isArray(updatedCasting.candidats)) {
        updatedCasting.candidats = updatedCasting.candidats.filter(
          (candidat: any) => candidat.acteurId != null && candidat.acteurId !== undefined
        );
      }

      return this.transformCasting(updatedCasting);
    } catch (error) {
      if (poster?.afficheFileId) {
        await this.mediaService.deleteFile(poster.afficheFileId);
      }
      throw error;
    }
  }

  async remove(id: string, userId: string, userRole: Role) {
    const casting = await this.castingModel.findById(id).exec();
    if (!casting) {
      throw new NotFoundException('Casting non trouvé');
    }

    // Seul le recruteur propriétaire ou un admin peut supprimer
    if (
      userRole !== Role.ADMIN &&
      casting.recruteur.toString() !== userId
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres castings',
      );
    }

    await this.mediaService.deleteMany([casting.media?.afficheFileId]);
    await this.castingModel.findByIdAndDelete(id).exec();
    return { message: 'Casting supprimé avec succès' };
  }

  async applyToCasting(
    castingId: string,
    acteurId: string,
    video?: Express.Multer.File,
    dto?: ApplyToCastingDto,
  ) {
    const casting = await this.castingModel.findById(castingId).exec();
    if (!casting) {
      throw new NotFoundException('Casting non trouvé');
    }

    // Vérifier si la date de fin est dépassée et fermer automatiquement
    if (casting.dateFin < new Date()) {
      casting.ouvert = false;
      await casting.save();
    }

    // Vérifier si le casting est ouvert
    if (!casting.ouvert) {
      throw new BadRequestException('Ce casting n\'accepte plus de candidatures (date de fin dépassée ou casting fermé manuellement)');
    }

    // Vérifier si l'acteur a déjà postulé
    const hasAlreadyApplied = casting.candidats.some(
      (candidat) => String(candidat.acteurId) === acteurId,
    );

    if (hasAlreadyApplied) {
      throw new ConflictException('Vous avez déjà postulé à ce casting');
    }

    // Préparer les données de candidature
    const candidatData: any = {
      acteurId: new Types.ObjectId(acteurId),
      statut: 'EN_ATTENTE',
      dateCandidature: new Date(),
    };

    // Si vidéo fournie, uploader et ajouter les métadonnées
    if (video) {
      // Note: La vérification de la durée (max 30s) devrait être faite côté frontend
      // On peut l'ajouter côté backend plus tard avec ffmpeg si nécessaire
      
      const acteurObjectId = new Types.ObjectId(acteurId);
      const castingObjectId = new Types.ObjectId(castingId);
      
      const storedVideo = await this.mediaService.storeAuditionVideo({
        ownerId: acteurObjectId,
        ownerRole: Role.ACTEUR,
        file: video,
        castingId: castingObjectId,
      });

      candidatData.auditionVideo = {
        fileId: storedVideo.fileId,
        mimeType: storedVideo.mimeType,
        duration: undefined, // Peut être ajouté plus tard avec ffmpeg
        size: storedVideo.length,
        uploadedAt: storedVideo.uploadDate,
      };
    }

    // Parser le feedback IA si fourni
    if (dto?.aiFeedback) {
      try {
        const aiFeedback = JSON.parse(dto.aiFeedback);
        candidatData.aiFeedback = {
          ...aiFeedback,
          analyzedAt: aiFeedback.analyzedAt ? new Date(aiFeedback.analyzedAt) : new Date(),
        };
      } catch (e) {
        // Si le JSON est invalide, continuer sans feedback
        console.warn('Feedback IA invalide:', e);
      }
    }

    // Ajouter la candidature avec statut EN_ATTENTE
    casting.candidats.push(candidatData);
    await casting.save();

    // Re-récupérer avec .lean() pour éviter la validation et filtrer les candidats invalides
    const updatedCasting = await this.castingModel
      .findById(castingId)
      .populate({
        path: 'recruteur',
        select: 'nomAgence responsable email tel gouvernorat siteWeb description socialLinks media',
      })
      .populate({
        path: 'candidats.acteurId',
        select: 'nom prenom email media',
        options: { strictPopulate: false },
      })
      .lean()
      .exec();

    if (!updatedCasting) {
      throw new NotFoundException('Casting non trouvé après candidature');
    }

    // Filtrer les candidats invalides
    if (updatedCasting.candidats && Array.isArray(updatedCasting.candidats)) {
      updatedCasting.candidats = updatedCasting.candidats.filter(
        (candidat: any) => candidat.acteurId != null && candidat.acteurId !== undefined
      );
    }

    return this.transformCasting(updatedCasting);
  }

  async acceptCandidate(
    castingId: string,
    acteurId: string,
    userId: string,
    userRole: Role,
  ) {
    const casting = await this.castingModel.findById(castingId).exec();
    if (!casting) {
      throw new NotFoundException('Casting non trouvé');
    }

    // Vérifier les permissions
    if (
      userRole !== Role.ADMIN &&
      casting.recruteur.toString() !== userId
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres castings',
      );
    }

    const candidat = casting.candidats.find(
      (c) => String(c.acteurId) === acteurId,
    );

    if (!candidat) {
      throw new NotFoundException('Candidat non trouvé');
    }

    candidat.statut = 'ACCEPTE';
    await casting.save();

    // Re-récupérer avec .lean() pour éviter la validation et filtrer les candidats invalides
    const updatedCasting = await this.castingModel
      .findById(castingId)
      .populate({
        path: 'recruteur',
        select: 'nomAgence responsable email tel gouvernorat siteWeb description socialLinks media',
      })
      .populate({
        path: 'candidats.acteurId',
        select: 'nom prenom email media',
        options: { strictPopulate: false },
      })
      .lean()
      .exec();

    if (!updatedCasting) {
      throw new NotFoundException('Casting non trouvé après mise à jour');
    }

    // Filtrer les candidats invalides
    if (updatedCasting.candidats && Array.isArray(updatedCasting.candidats)) {
      updatedCasting.candidats = updatedCasting.candidats.filter(
        (candidat: any) => candidat.acteurId != null && candidat.acteurId !== undefined
      );
    }

    return this.transformCasting(updatedCasting);
  }

  async rejectCandidate(
    castingId: string,
    acteurId: string,
    userId: string,
    userRole: Role,
  ) {
    const casting = await this.castingModel.findById(castingId).exec();
    if (!casting) {
      throw new NotFoundException('Casting non trouvé');
    }

    // Vérifier les permissions
    if (
      userRole !== Role.ADMIN &&
      casting.recruteur.toString() !== userId
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres castings',
      );
    }

    const candidat = casting.candidats.find(
      (c) => String(c.acteurId) === acteurId,
    );

    if (!candidat) {
      throw new NotFoundException('Candidat non trouvé');
    }

    candidat.statut = 'REFUSE';
    await casting.save();

    // Re-récupérer avec .lean() pour éviter la validation et filtrer les candidats invalides
    const updatedCasting = await this.castingModel
      .findById(castingId)
      .populate({
        path: 'recruteur',
        select: 'nomAgence responsable email tel gouvernorat siteWeb description socialLinks media',
      })
      .populate({
        path: 'candidats.acteurId',
        select: 'nom prenom email media',
        options: { strictPopulate: false },
      })
      .lean()
      .exec();

    if (!updatedCasting) {
      throw new NotFoundException('Casting non trouvé après mise à jour');
    }

    // Filtrer les candidats invalides
    if (updatedCasting.candidats && Array.isArray(updatedCasting.candidats)) {
      updatedCasting.candidats = updatedCasting.candidats.filter(
        (candidat: any) => candidat.acteurId != null && candidat.acteurId !== undefined
      );
    }

    return this.transformCasting(updatedCasting);
  }

  async getCandidateStatus(castingId: string, acteurId: string) {
    const casting = await this.castingModel.findById(castingId).exec();
    if (!casting) {
      throw new NotFoundException('Casting non trouvé');
    }

    const candidat = casting.candidats.find(
      (c) => String(c.acteurId) === acteurId,
    );

    if (!candidat) {
      return { hasApplied: false, statut: null };
    }

    return {
      hasApplied: true,
      statut: candidat.statut,
      dateCandidature: candidat.dateCandidature,
    };
  }

  async getCandidateVideo(
    castingId: string,
    acteurId: string,
    userId: string,
    userRole: Role,
    response: Response,
  ): Promise<StreamableFile> {
    const casting = await this.castingModel.findById(castingId).exec();
    if (!casting) {
      throw new NotFoundException('Casting non trouvé');
    }

    // Vérifier les permissions
    const isRecruteurOwner =
      userRole === Role.RECRUTEUR &&
      casting.recruteur.toString() === userId;
    const isActeurOwner = userRole === Role.ACTEUR && acteurId === userId;
    const isAdmin = userRole === Role.ADMIN;

    if (!isRecruteurOwner && !isActeurOwner && !isAdmin) {
      throw new ForbiddenException(
        'Vous n\'avez pas accès à cette vidéo d\'audition',
      );
    }

    // Trouver le candidat
    const candidat = casting.candidats.find(
      (c) => String(c.acteurId) === acteurId,
    );

    if (!candidat) {
      throw new NotFoundException('Candidat non trouvé');
    }

    if (!candidat.auditionVideo?.fileId) {
      throw new NotFoundException('Aucune vidéo d\'audition trouvée pour ce candidat');
    }

    // Récupérer et streamer la vidéo
    const { file, stream } = await this.mediaService.getFileStream(
      candidat.auditionVideo.fileId,
      { id: userId, role: userRole },
    );

    response.set({
      'Content-Type': file.contentType ?? 'video/mp4',
      ...(file.length ? { 'Content-Length': file.length.toString() } : {}),
      'Content-Disposition': `inline; filename="${encodeURIComponent(
        file.filename ?? file.metadata?.originalName ?? 'audition-video',
      )}"`,
      'Cache-Control': 'private, no-cache',
    });

    return new StreamableFile(stream);
  }

  async acceptCandidateWithInterview(
    castingId: string,
    acteurId: string,
    userId: string,
    userRole: Role,
    dto: AcceptCandidateWithInterviewDto,
  ) {
    const casting = await this.castingModel.findById(castingId).exec();
    if (!casting) {
      throw new NotFoundException('Casting non trouvé');
    }

    // Vérifier les permissions
    if (
      userRole !== Role.ADMIN &&
      casting.recruteur.toString() !== userId
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres castings',
      );
    }

    // Trouver le candidat
    const candidat = casting.candidats.find(
      (c) => String(c.acteurId) === acteurId,
    );

    if (!candidat) {
      throw new NotFoundException('Candidat non trouvé');
    }

    // Vérifier que le candidat a le statut "EN_ATTENTE"
    if (candidat.statut !== 'EN_ATTENTE') {
      throw new BadRequestException(
        'Seuls les candidats en attente peuvent être acceptés avec une interview',
      );
    }

    // Mettre à jour le statut du candidat à "ACCEPTE"
    candidat.statut = 'ACCEPTE';
    await casting.save();

    // Récupérer les informations de l'acteur
    const acteur = await this.acteurService.findById(acteurId);
    if (!acteur) {
      throw new NotFoundException('Acteur non trouvé');
    }
    const acteurName = `${acteur.prenom} ${acteur.nom}`;

    // Récupérer les informations de l'agence
    const agence = await this.agenceService.findById(userId);
    if (!agence) {
      throw new NotFoundException('Agence non trouvée');
    }
    const agenceName = agence.nomAgence;

    // Créer l'interview
    const interview = await this.interviewsService.create(
      castingId,
      casting.titre,
      acteurId,
      acteurName,
      userId,
      agenceName,
      dto,
    );

    // Re-récupérer le casting avec les populations
    const updatedCasting = await this.castingModel
      .findById(castingId)
      .populate({
        path: 'recruteur',
        select: 'nomAgence responsable email tel gouvernorat siteWeb description socialLinks media',
      })
      .populate({
        path: 'candidats.acteurId',
        select: 'nom prenom email media',
        options: { strictPopulate: false },
      })
      .lean()
      .exec();

    if (!updatedCasting) {
      throw new NotFoundException('Casting non trouvé après mise à jour');
    }

    // Filtrer les candidats invalides
    if (updatedCasting.candidats && Array.isArray(updatedCasting.candidats)) {
      updatedCasting.candidats = updatedCasting.candidats.filter(
        (candidat: any) => candidat.acteurId != null && candidat.acteurId !== undefined
      );
    }

    return {
      casting: this.transformCasting(updatedCasting),
      interview,
    };
  }
}

