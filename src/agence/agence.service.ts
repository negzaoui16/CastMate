import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CreateAgenceDto } from './dto/create-agence.dto';
import { UpdateAgenceDto } from './dto/update-agence.dto';
import {
  MediaFilesPayload,
  MediaService,
  UserMediaMetadata,
} from '../media/media.service';
import { Role } from '../common/enums/role.enum';
import { Agence, AgenceDocument } from './schemas/agence.schema';

@Injectable()
export class AgenceService {
  constructor(
    @InjectModel(Agence.name) private agenceModel: Model<AgenceDocument>,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * Crée une nouvelle agence dans la base de données
   * 
   * Fonctionnement :
   * 1. Vérifie que l'email n'existe pas déjà (éviter les doublons)
   * 2. Hash le mot de passe avec bcrypt (sécurité)
   * 3. Génère un ID unique pour l'agence
   * 4. Si des fichiers sont fournis (photo, document), les upload dans GridFS
   * 5. Crée le document agence dans MongoDB avec toutes les informations
   * 6. Sauvegarde l'agence dans la base de données
   * 7. Si une erreur se produit, supprime les fichiers uploadés (nettoyage)
   * 
   * @param createAgenceDto - Les données de l'agence à créer (nom, email, mot de passe, etc.)
   * @param mediaFiles - Optionnel : Les fichiers à uploader (photo de profil et/ou document)
   * @returns Le document agence créé
   * 
   * Exemple :
   * Input:
   *   createAgenceDto = {
   *     nomAgence: "Agence de Casting Paris",
   *     responsable: "Jean Dupont",
   *     email: "agence@example.com",
   *     motDePasse: "monMotDePasse123",
   *     tel: "0123456789",
   *     gouvernorat: "Paris",
   *     ...
   *   }
   *   mediaFiles = {
   *     photo: File { originalname: "logo.jpg", ... },
   *     document: File { originalname: "certificat.pdf", ... }
   *   }
   * 
   * Output:
   *   {
   *     _id: ObjectId("507f1f77bcf86cd799439011"),
   *     nomAgence: "Agence de Casting Paris",
   *     email: "agence@example.com",
   *     role: "RECRUTEUR",
   *     media: { photoFileId: ObjectId("123"), documentFileId: ObjectId("456"), ... },
   *     dateCreation: Date("2024-01-15"),
   *     ...
   *   }
   */
  async create(
    createAgenceDto: CreateAgenceDto, // Les données de l'agence (nom, email, mot de passe, etc.)
    mediaFiles: MediaFilesPayload = {}, // Optionnel : fichiers à uploader (photo, document)
  ): Promise<AgenceDocument> {
    // ÉTAPE 1 : Vérifier que l'email n'existe pas déjà
    // On cherche une agence avec cet email dans la base de données
    // Exemple : Si createAgenceDto.email = "agence@example.com", on cherche dans la collection "agences"
    const existingAgence = await this.findByEmail(createAgenceDto.email);
    
    // Si une agence avec cet email existe déjà, on refuse la création
    // Cela évite d'avoir plusieurs comptes avec le même email
    if (existingAgence) {
      throw new ConflictException('Une agence avec cet email existe déjà');
    }

    // ÉTAPE 2 : Hasher le mot de passe avec bcrypt
    // bcrypt.hash transforme le mot de passe en clair en un hash sécurisé
    // Le 10 est le nombre de "rounds" (tours) de hachage (plus c'est élevé, plus c'est sécurisé)
    // 
    // Exemple :
    //   createAgenceDto.motDePasse = "monMotDePasse123"
    //   hashedPassword = "$2b$10$xyz..." (hash sécurisé de 60 caractères)
    // 
    // Pourquoi hasher ?
    // - Si quelqu'un accède à la base de données, il ne peut pas voir les mots de passe en clair
    // - Même avec le hash, il est très difficile de retrouver le mot de passe original
    const hashedPassword = await bcrypt.hash(createAgenceDto.motDePasse, 10);
    
    // ÉTAPE 3 : Générer un ID unique pour la nouvelle agence
    // Types.ObjectId() génère un identifiant unique MongoDB
    // Exemple : new Types.ObjectId() → ObjectId("507f1f77bcf86cd799439011")
    const agenceId = new Types.ObjectId();
    
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
          agenceId, // ID de l'agence (propriétaire des fichiers)
          Role.RECRUTEUR, // Rôle de l'agence (toujours RECRUTEUR)
          mediaFiles, // Les fichiers à uploader
        );
      }

      // ÉTAPE 6 : Créer le document agence dans MongoDB
      // On crée un nouvel objet avec toutes les données de l'agence
      // 
      // Structure du document :
      // {
      //   _id: ObjectId("507f1f77bcf86cd799439011"),
      //   nomAgence: "Agence de Casting Paris",
      //   responsable: "Jean Dupont",
      //   email: "agence@example.com",
      //   motDePasse: "$2b$10$xyz...", // Hash du mot de passe (pas le mot de passe en clair !)
      //   role: "RECRUTEUR",
      //   dateCreation: Date("2024-01-15"),
      //   media: { photoFileId: ObjectId("123"), ... }, // Si fichiers uploadés
      //   ...
      // }
      const createdAgence = new this.agenceModel({
        _id: agenceId, // ID unique de l'agence
        ...createAgenceDto, // Toutes les données du DTO (nomAgence, responsable, email, tel, etc.)
        motDePasse: hashedPassword, // Mot de passe hashé (pas en clair !)
        role: Role.RECRUTEUR, // Rôle de l'agence (toujours RECRUTEUR)
        dateCreation: new Date(), // Date de création (maintenant)
        ...(media ? { media } : {}), // Métadonnées des fichiers si uploadés
      });
      
      // ÉTAPE 7 : Sauvegarder l'agence dans la base de données
      // .save() écrit le document dans la collection "agences" de MongoDB
      return await createdAgence.save();
    } catch (error) {
      // En cas d'erreur, supprimer les fichiers uploadés pour ne pas laisser de fichiers orphelins
      // Si les fichiers ont été uploadés mais que la création de l'agence a échoué,
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

  async findAll(): Promise<AgenceDocument[]> {
    return this.agenceModel.find().select('-motDePasse').exec();
  }

  async findById(id: string): Promise<AgenceDocument | null> {
    return this.agenceModel.findById(id).select('-motDePasse').exec();
  }

  async findByEmail(email: string): Promise<AgenceDocument | null> {
    return this.agenceModel.findOne({ email }).exec();
  }

  async updatePassword(email: string, hashedPassword: string): Promise<void> {
    const result = await this.agenceModel
      .updateOne({ email }, { motDePasse: hashedPassword })
      .exec();
    if (result.matchedCount === 0) {
      throw new NotFoundException('Agence non trouvée');
    }
  }

  private enforceResetRateLimit(user: AgenceDocument) {
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
    const user = await this.agenceModel.findOne({ email }).exec();
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

    const user = await this.agenceModel.findOne({ resetPasswordToken: token, email }).exec();
    if (!user) {
      throw new NotFoundException('Token introuvable');
    }

    if (!user.resetPasswordExpiry || user.resetPasswordExpiry < new Date()) {
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

  async update(id: string, updateAgenceDto: UpdateAgenceDto): Promise<AgenceDocument> {
    // Si le mot de passe est fourni, le hasher
    if (updateAgenceDto.motDePasse) {
      updateAgenceDto.motDePasse = await bcrypt.hash(updateAgenceDto.motDePasse, 10);
    }

    const updatedAgence = await this.agenceModel
      .findByIdAndUpdate(id, updateAgenceDto, { new: true })
      .select('-motDePasse')
      .exec();
    if (!updatedAgence) {
      throw new NotFoundException('Agence non trouvée');
    }
    return updatedAgence;
  }

  async updateMedia(
    id: string,
    mediaFiles: MediaFilesPayload,
    currentUserId: string,
    currentUserRole: Role,
  ) {
    const agence = await this.agenceModel.findById(id).exec();
    if (!agence) {
      throw new NotFoundException('Agence non trouvée');
    }

    // Vérifier les permissions : l'agence ne peut modifier que son propre profil, sauf si c'est un admin
    const agenceId = String(agence._id);
    if (currentUserRole !== Role.ADMIN && currentUserId !== agenceId) {
      throw new ForbiddenException('Vous ne pouvez modifier que votre propre profil');
    }

    if (!mediaFiles.photo && !mediaFiles.document) {
      throw new ConflictException(
        'Aucun fichier fourni pour mettre à jour le profil.',
      );
    }

    const { media, deletedFileIds } = await this.mediaService.updateUserMedia({
      ownerId: agence._id as Types.ObjectId,
      ownerRole: Role.RECRUTEUR,
      files: mediaFiles,
      currentMedia: agence.media ?? undefined,
    });

    agence.media = media;
    agence.markModified('media');
    await agence.save();

    await this.mediaService.deleteMany(deletedFileIds);

    return agence.toObject();
  }

  async remove(id: string): Promise<void> {
    const result = await this.agenceModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Agence non trouvée');
    }
  }
}

