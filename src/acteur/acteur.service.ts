import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CreateActeurDto } from './dto/create-acteur.dto';
import { UpdateActeurDto } from './dto/update-acteur.dto';
import type { Express } from 'express';
import {
  MediaFilesPayload,
  MediaService,
  UserMediaMetadata,
} from '../media/media.service';
import { Role } from '../common/enums/role.enum';
import { Acteur, ActeurDocument } from './schemas/acteur.schema';
import * as crypto from 'crypto';
import { Casting, CastingDocument } from '../castings/schemas/casting.schema';

@Injectable()
export class ActeurService {
  constructor(
    @InjectModel(Acteur.name) private acteurModel: Model<ActeurDocument>,
    @InjectModel(Casting.name) private castingModel: Model<CastingDocument>,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * Crée un nouvel acteur dans la base de données
   * 
   * Fonctionnement :
   * 1. Vérifie que l'email n'existe pas déjà (éviter les doublons)
   * 2. Hash le mot de passe avec bcrypt (sécurité)
   * 3. Génère un ID unique pour l'acteur
   * 4. Si des fichiers sont fournis (photo, document), les upload dans GridFS
   * 5. Crée le document acteur dans MongoDB avec toutes les informations
   * 6. Sauvegarde l'acteur dans la base de données
   * 7. Si une erreur se produit, supprime les fichiers uploadés (nettoyage)
   * 
   * @param createActeurDto - Les données de l'acteur à créer (nom, prénom, email, mot de passe, etc.)
   * @param mediaFiles - Optionnel : Les fichiers à uploader (photo de profil et/ou document/CV)
   * @returns Le document acteur créé
   * 
   * Exemple :
   * Input:
   *   createActeurDto = {
   *     nom: "Dupont",
   *     prenom: "Jean",
   *     email: "jean.dupont@example.com",
   *     motDePasse: "monMotDePasse123",
   *     tel: "0123456789",
   *     dateNaissance: "1990-01-15",
   *     ...
   *   }
   *   mediaFiles = {
   *     photo: File { originalname: "photo.jpg", ... },
   *     document: File { originalname: "cv.pdf", ... }
   *   }
   * 
   * Output:
   *   {
   *     _id: ObjectId("507f1f77bcf86cd799439011"),
   *     nom: "Dupont",
   *     prenom: "Jean",
   *     email: "jean.dupont@example.com",
   *     role: "ACTEUR",
   *     media: { photoFileId: ObjectId("123"), documentFileId: ObjectId("456"), ... },
   *     dateCreation: Date("2024-01-15"),
   *     ...
   *   }
   */
  async create(
    createActeurDto: CreateActeurDto, // Les données de l'acteur (nom, prénom, email, mot de passe, etc.)
    mediaFiles: MediaFilesPayload = {}, // Optionnel : fichiers à uploader (photo, document)
  ): Promise<ActeurDocument> {
    // ÉTAPE 1 : Vérifier que l'email n'existe pas déjà
    // On cherche un acteur avec cet email dans la base de données
    // Exemple : Si createActeurDto.email = "jean.dupont@example.com", on cherche dans la collection "acteurs"
    const existingActeur = await this.findByEmail(createActeurDto.email);
    
    // Si un acteur avec cet email existe déjà, on refuse la création
    // Cela évite d'avoir plusieurs comptes avec le même email
    if (existingActeur) {
      throw new ConflictException('Un acteur avec cet email existe déjà');
    }

    // ÉTAPE 2 : Hasher le mot de passe avec bcrypt
    // bcrypt.hash transforme le mot de passe en clair en un hash sécurisé
    // Le 10 est le nombre de "rounds" (tours) de hachage
    // 
    // Exemple :
    //   createActeurDto.motDePasse = "monMotDePasse123"
    //   hashedPassword = "$2b$10$xyz..." (hash sécurisé de 60 caractères)
    // 
    // Pourquoi hasher ?
    // - Sécurité : si quelqu'un accède à la base de données, il ne peut pas voir les mots de passe
    // - Même avec le hash, il est très difficile de retrouver le mot de passe original
    const hashedPassword = await bcrypt.hash(createActeurDto.motDePasse, 10);
    
    // ÉTAPE 3 : Générer un ID unique pour le nouvel acteur
    // Types.ObjectId() génère un identifiant unique MongoDB
    // Exemple : new Types.ObjectId() → ObjectId("507f1f77bcf86cd799439011")
    const acteurId = new Types.ObjectId();

    // ÉTAPE 4 : Vérifier si des fichiers sont fournis
    // hasMedia sera true si au moins un fichier (photo ou document) est fourni
    // Exemple : Si mediaFiles.photo existe OU mediaFiles.document existe → hasMedia = true
    const hasMedia = Boolean(mediaFiles.photo || mediaFiles.document);
    
    // Initialiser la variable pour stocker les métadonnées des fichiers uploadés
    let media: UserMediaMetadata | undefined;

    // On utilise try/catch pour gérer les erreurs
    // Si une erreur se produit, on supprime les fichiers uploadés
    try {
      // ÉTAPE 5 : Uploader les fichiers si ils sont fournis
      // Si l'utilisateur a fourni une photo et/ou un document, on les upload dans GridFS
      if (hasMedia) {
        // storeUserMedia upload les fichiers dans GridFS et retourne les métadonnées
        // Exemple :
        //   mediaFiles = { photo: File {...}, document: File {...} }
        //   Après upload :
        //   media = {
        //     photoFileId: ObjectId("123"),
        //     photoMimeType: "image/jpeg",
        //     documentFileId: ObjectId("456"),
        //     documentMimeType: "application/pdf",
        //     ...
        //   }
        media = await this.mediaService.storeUserMedia(
          acteurId, // ID de l'acteur (propriétaire des fichiers)
          Role.ACTEUR, // Rôle de l'acteur (toujours ACTEUR)
          mediaFiles, // Les fichiers à uploader
        );
      }

      // ÉTAPE 6 : Créer le document acteur dans MongoDB
      // On crée un nouvel objet avec toutes les données de l'acteur
      // 
      // Structure du document :
      // {
      //   _id: ObjectId("507f1f77bcf86cd799439011"),
      //   nom: "Dupont",
      //   prenom: "Jean",
      //   email: "jean.dupont@example.com",
      //   motDePasse: "$2b$10$xyz...", // Hash du mot de passe (pas le mot de passe en clair !)
      //   role: "ACTEUR",
      //   dateCreation: Date("2024-01-15"),
      //   media: { photoFileId: ObjectId("123"), ... }, // Si fichiers uploadés
      //   favoris: [], // Liste vide de favoris au début
      //   ...
      // }
      const createdActeur = new this.acteurModel({
        _id: acteurId, // ID unique de l'acteur
        ...createActeurDto, // Toutes les données du DTO (nom, prenom, email, tel, dateNaissance, etc.)
        motDePasse: hashedPassword, // Mot de passe hashé (pas en clair !)
        role: Role.ACTEUR, // Rôle de l'acteur (toujours ACTEUR)
        dateCreation: new Date(), // Date de création (maintenant)
        ...(media ? { media } : {}), // Métadonnées des fichiers si uploadés
      });

      // ÉTAPE 7 : Sauvegarder l'acteur dans la base de données
      // .save() écrit le document dans la collection "acteurs" de MongoDB
      return await createdActeur.save();
    } catch (error) {
      // En cas d'erreur, supprimer les fichiers uploadés pour ne pas laisser de fichiers orphelins
      // Si les fichiers ont été uploadés mais que la création de l'acteur a échoué,
      // on supprime les fichiers pour ne pas gaspiller de l'espace de stockage
      if (hasMedia) {
        await this.mediaService.deleteMany([
          media?.photoFileId, // ID de la photo si uploadée
          media?.documentFileId, // ID du document si uploadé
        ]);
      }
      // Relancer l'erreur pour que le controller puisse la gérer
      throw error;
    }
  }

  async findAll(): Promise<ActeurDocument[]> {
    return this.acteurModel.find().select('-motDePasse').exec();
  }

  async findById(id: string): Promise<ActeurDocument | null> {
    return this.acteurModel.findById(id).select('-motDePasse').exec();
  }

  async findByEmail(email: string): Promise<ActeurDocument | null> {
    return this.acteurModel.findOne({ email }).exec();
  }

  async updatePassword(email: string, hashedPassword: string): Promise<void> {
    const result = await this.acteurModel
      .updateOne({ email }, { motDePasse: hashedPassword })
      .exec();
    if (result.matchedCount === 0) {
      throw new NotFoundException('Acteur non trouvé');
    }
  }

  private enforceResetRateLimit(user: ActeurDocument) {
    const now = new Date();
    const windowMs = 60 * 60 * 1000; // 1h
    const maxRequests = 5;

    const requests = user.resetPasswordRequests ?? {};
    const windowStart = requests.windowStart ? new Date(requests.windowStart) : new Date(0);
    const diff = now.getTime() - windowStart.getTime();
    let count = requests.count ?? 0;

    if (diff > windowMs) {
      user.resetPasswordRequests = { windowStart: now, count: 0 };
      count = 0;
    }

    if (count >= maxRequests) {
      throw new HttpException('Trop de demandes. Réessayez plus tard.', HttpStatus.TOO_MANY_REQUESTS);
    }

    user.resetPasswordRequests = { windowStart: requests.windowStart ?? now, count: count + 1 };
  }

  async requestPasswordReset(email: string): Promise<{ token: string }> {
    const user = await this.acteurModel.findOne({ email }).exec();
    if (!user) {
      throw new NotFoundException('Compte introuvable');
    }

    this.enforceResetRateLimit(user);

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // +1h

    user.resetPasswordToken = token;
    user.resetPasswordExpiry = expiry;
    await user.save();

    return { token };
  }

  async resetPasswordByToken(token: string, email: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Mot de passe invalide (min 8 caractères).');
    }

    const user = await this.acteurModel.findOne({ resetPasswordToken: token, email }).exec();
    if (!user) {
      throw new NotFoundException('Token introuvable');
    }

    if (!user.resetPasswordExpiry || user.resetPasswordExpiry < new Date()) {
      // Invalider si expiré
      user.resetPasswordToken = null;
      user.resetPasswordExpiry = null;
      await user.save();
      throw new BadRequestException('Token expiré');
    }

    user.motDePasse = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpiry = null;
    await user.save();
  }

  async update(id: string, updateActeurDto: UpdateActeurDto): Promise<ActeurDocument> {
    // Si le mot de passe est fourni, le hasher
    if (updateActeurDto.motDePasse) {
      updateActeurDto.motDePasse = await bcrypt.hash(updateActeurDto.motDePasse, 10);
    }

    const updatedActeur = await this.acteurModel
      .findByIdAndUpdate(id, updateActeurDto, { new: true })
      .select('-motDePasse')
      .exec();
    if (!updatedActeur) {
      throw new NotFoundException('Acteur non trouvé');
    }
    return updatedActeur;
  }

  async updateMedia(
    id: string,
    mediaFiles: MediaFilesPayload,
    currentUserId: string,
    currentUserRole: Role,
  ) {
    const acteur = await this.acteurModel.findById(id).exec();
    if (!acteur) {
      throw new NotFoundException('Acteur non trouvé');
    }

    this.assertCanModify(acteur, currentUserId, currentUserRole);

    if (!mediaFiles.photo && !mediaFiles.document) {
      throw new ConflictException(
        'Aucun fichier fourni pour mettre à jour le profil.',
      );
    }

    const { media, deletedFileIds } = await this.mediaService.updateUserMedia({
      ownerId: acteur._id as Types.ObjectId,
      ownerRole: Role.ACTEUR,
      files: mediaFiles,
      currentMedia: acteur.media ?? undefined,
    });

    media.gallery = acteur.media?.gallery;
    acteur.media = media;
    acteur.markModified('media');
    await acteur.save();

    await this.mediaService.deleteMany(deletedFileIds);

    return acteur.toObject();
  }

  async addGalleryPhotos(
    id: string,
    files: Express.Multer.File[],
    currentUserId: string,
    currentUserRole: Role,
  ) {
    const acteur = await this.acteurModel.findById(id).exec();
    if (!acteur) {
      throw new NotFoundException('Acteur non trouvé');
    }

    this.assertCanModify(acteur, currentUserId, currentUserRole);

    if (!files.length) {
      throw new ConflictException(
        'Veuillez fournir au moins une photo à ajouter.',
      );
    }

    const galleryMetadata = await this.mediaService.addGalleryPhotos({
      ownerId: acteur._id as Types.ObjectId,
      ownerRole: Role.ACTEUR,
      files,
    });

    if (!galleryMetadata.length) {
      return acteur.toObject();
    }

    acteur.media = acteur.media ?? {};
    acteur.media.gallery = [
      ...(acteur.media.gallery ?? []),
      ...galleryMetadata,
    ];
    acteur.markModified('media');

    await acteur.save();

    return acteur.toObject();
  }

  async removeGalleryPhoto(
    id: string,
    fileId: string,
    currentUserId: string,
    currentUserRole: Role,
  ) {
    const acteur = await this.acteurModel.findById(id).exec();
    if (!acteur) {
      throw new NotFoundException('Acteur non trouvé');
    }

    this.assertCanModify(acteur, currentUserId, currentUserRole);

    const gallery = acteur.media?.gallery ?? [];
    const index = gallery.findIndex(
      (item) => String(item.fileId) === String(fileId),
    );

    if (index === -1) {
      throw new NotFoundException('Photo non trouvée dans la galerie');
    }

    const [removed] = gallery.splice(index, 1);
    acteur.media = {
      ...(acteur.media ?? {}),
      gallery: gallery.length ? gallery : undefined,
    };
    acteur.markModified('media');

    await acteur.save();
    await this.mediaService.deleteFile(removed.fileId);

    return acteur.toObject();
  }

  async remove(id: string): Promise<void> {
    const acteur = await this.acteurModel.findById(id).exec();
    if (!acteur) {
      throw new NotFoundException('Acteur non trouvé');
    }

    const filesToDelete: (Types.ObjectId | string | undefined)[] = [
      acteur.media?.photoFileId,
      acteur.media?.documentFileId,
      ...(acteur.media?.gallery?.map((item) => item.fileId) ?? []),
    ];

    await this.acteurModel.findByIdAndDelete(id).exec();
    await this.mediaService.deleteMany(filesToDelete);
  }

  async addFavori(
    acteurId: string,
    castingId: string,
    currentUserId: string,
    currentUserRole: Role,
  ) {
    const acteur = await this.acteurModel.findById(acteurId).exec();
    if (!acteur) {
      throw new NotFoundException('Acteur non trouvé');
    }

    this.assertCanModify(acteur, currentUserId, currentUserRole);

    // Vérifier que le casting existe
    const casting = await this.castingModel.findById(castingId).exec();
    if (!casting) {
      throw new NotFoundException('Casting non trouvé');
    }

    const castingObjectId = new Types.ObjectId(castingId);
    const favoris = acteur.favoris ?? [];

    // Vérifier si le casting est déjà en favoris
    if (favoris.some((id) => String(id) === castingId)) {
      throw new ConflictException('Ce casting est déjà dans vos favoris');
    }

    acteur.favoris = [...favoris, castingObjectId];
    await acteur.save();

    return acteur.toObject();
  }

  async removeFavori(
    acteurId: string,
    castingId: string,
    currentUserId: string,
    currentUserRole: Role,
  ) {
    const acteur = await this.acteurModel.findById(acteurId).exec();
    if (!acteur) {
      throw new NotFoundException('Acteur non trouvé');
    }

    this.assertCanModify(acteur, currentUserId, currentUserRole);

    const favoris = acteur.favoris ?? [];
    const index = favoris.findIndex((id) => String(id) === castingId);

    if (index === -1) {
      throw new NotFoundException('Ce casting n\'est pas dans vos favoris');
    }

    acteur.favoris = favoris.filter((id) => String(id) !== castingId);
    await acteur.save();

    return acteur.toObject();
  }

  async getFavoris(acteurId: string, currentUserId: string, currentUserRole: Role) {
    const acteur = await this.acteurModel.findById(acteurId).exec();
    if (!acteur) {
      throw new NotFoundException('Acteur non trouvé');
    }

    // Vérifier que l'utilisateur peut consulter ce profil
    if (
      currentUserRole !== Role.ADMIN &&
      String(acteur._id) !== String(currentUserId)
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez consulter que vos propres favoris',
      );
    }

    const favorisIds = acteur.favoris ?? [];
    
    if (favorisIds.length === 0) {
      return [];
    }

    // Récupérer les castings avec leurs informations complètes
    // Utiliser le même format que findAll() pour la cohérence
    const castings = await this.castingModel
      .find({ _id: { $in: favorisIds } })
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
    
    // Filtrer les candidats invalides pour chaque casting (comme dans findAll)
    // S'assurer que acteurId est un objet peuplé, pas un ObjectId ou une string
    return castings.map((casting: any) => {
      if (casting.candidats && Array.isArray(casting.candidats)) {
        casting.candidats = casting.candidats.filter((candidat: any) => {
          // Vérifier que acteurId existe
          if (!candidat.acteurId || candidat.acteurId === null || candidat.acteurId === undefined) {
            return false;
          }
          
          // Si acteurId est une string, c'est qu'il n'a pas été peuplé (ObjectId sérialisé)
          // On le filtre pour éviter les erreurs de désérialisation
          if (typeof candidat.acteurId === 'string') {
            return false;
          }
          
          // Si acteurId est un objet, vérifier qu'il a été peuplé (a des propriétés comme 'nom')
          // Un ObjectId avec .lean() reste un ObjectId, mais un objet peuplé aura 'nom', 'prenom', etc.
          if (typeof candidat.acteurId === 'object') {
            // Vérifier si c'est un ObjectId (a toString mais pas de propriétés peuplées)
            if (candidat.acteurId.toString && !candidat.acteurId.nom) {
              return false;
            }
            // Si c'est un objet avec 'nom', c'est qu'il a été peuplé correctement
            return candidat.acteurId.nom !== undefined;
          }
          
          return false;
        });
      }
      return casting;
    });
  }

  private assertCanModify(
    acteur: ActeurDocument,
    currentUserId: string,
    currentUserRole: Role,
  ) {
    if (
      currentUserRole !== Role.ADMIN &&
      String(acteur._id) !== String(currentUserId)
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que votre propre profil',
      );
    }
  }
}

