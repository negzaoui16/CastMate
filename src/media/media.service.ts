import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Types, Model } from 'mongoose';
import { GridFSBucket, GridFSFile, GridFSBucketReadStream } from 'mongodb';
import { Readable } from 'stream';
import { Role } from '../common/enums/role.enum';
import { GRIDFS_BUCKET_NAME } from './media.constants';
import { Casting, CastingDocument } from '../castings/schemas/casting.schema';
import type { Express } from 'express';

export interface MediaFilesPayload {
  photo?: Express.Multer.File;
  document?: Express.Multer.File;
}

export interface StoredFileReference {
  fileId: Types.ObjectId;
  mimeType: string;
  originalName: string;
  length: number;
  uploadDate: Date;
}

export interface GalleryFileMetadata {
  fileId: Types.ObjectId;
  mimeType: string;
  originalName: string;
  length: number;
  uploadDate: Date;
}

export interface UserMediaMetadata {
  photoFileId?: Types.ObjectId;
  photoMimeType?: string;
  photoOriginalName?: string;
  photoLength?: number;
  photoUploadDate?: Date;
  documentFileId?: Types.ObjectId;
  documentMimeType?: string;
  documentOriginalName?: string;
  documentLength?: number;
  documentUploadDate?: Date;
  gallery?: GalleryFileMetadata[];
}

export interface CastingMediaMetadata {
  afficheFileId?: Types.ObjectId;
  afficheMimeType?: string;
  afficheOriginalName?: string;
  afficheLength?: number;
  afficheUploadDate?: Date;
}

@Injectable()
export class MediaService {
  private readonly bucket: GridFSBucket;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Casting.name) private readonly castingModel: Model<CastingDocument>,
  ) {
    const db = this.connection.db;
    if (!db) {
      throw new Error('Connexion MongoDB non initialisée pour GridFS');
    }

    this.bucket = new GridFSBucket(db, {
      bucketName: GRIDFS_BUCKET_NAME,
    });
  }

  /**
   * Stocke les médias d'un utilisateur (photo de profil et/ou document/CV) dans GridFS
   * 
   * GridFS est un système de stockage de fichiers de MongoDB qui permet de stocker
   * des fichiers de grande taille (images, PDFs, etc.) directement dans la base de données
   * 
   * Fonctionnement :
   * 1. Si une photo est fournie, on l'upload dans GridFS
   * 2. Si un document est fourni, on l'upload dans GridFS
   * 3. On stocke les métadonnées (ID du fichier, type, taille, date) dans un objet
   * 4. Si une erreur se produit, on supprime tous les fichiers uploadés (nettoyage)
   * 
   * @param ownerId - L'ID de l'utilisateur propriétaire (acteur ou agence)
   * @param ownerRole - Le rôle du propriétaire (ACTEUR ou RECRUTEUR)
   * @param files - Les fichiers à uploader (photo et/ou document)
   * @returns Un objet avec les métadonnées des fichiers uploadés
   * 
   * Exemple :
   * Input:
   *   ownerId = ObjectId("507f1f77bcf86cd799439011")
   *   ownerRole = "ACTEUR"
   *   files = {
   *     photo: File { originalname: "photo.jpg", mimetype: "image/jpeg", buffer: [...] },
   *     document: File { originalname: "cv.pdf", mimetype: "application/pdf", buffer: [...] }
   *   }
   * 
   * Output:
   *   {
   *     photoFileId: ObjectId("123"),
   *     photoMimeType: "image/jpeg",
   *     photoOriginalName: "photo.jpg",
   *     photoLength: 50000,
   *     photoUploadDate: Date("2024-01-15"),
   *     documentFileId: ObjectId("456"),
   *     documentMimeType: "application/pdf",
   *     documentOriginalName: "cv.pdf",
   *     documentLength: 200000,
   *     documentUploadDate: Date("2024-01-15")
   *   }
   */
  async storeUserMedia(
    ownerId: Types.ObjectId, // ID de l'utilisateur (ex: ObjectId("507f1f77bcf86cd799439011"))
    ownerRole: Role, // Rôle de l'utilisateur (ACTEUR ou RECRUTEUR)
    files: MediaFilesPayload, // Les fichiers à uploader (photo et/ou document)
  ): Promise<UserMediaMetadata> {
    // ÉTAPE 1 : Initialiser les listes pour suivre les fichiers uploadés
    // uploadedIds : liste des IDs des fichiers uploadés (pour pouvoir les supprimer en cas d'erreur)
    // media : objet qui contiendra les métadonnées des fichiers uploadés
    const uploadedIds: Types.ObjectId[] = [];
    const media: UserMediaMetadata = {};

    // On utilise try/catch pour gérer les erreurs
    // Si une erreur se produit, on supprime tous les fichiers uploadés
    try {
      // ÉTAPE 2 : Uploader la photo de profil si elle est fournie
      // files.photo peut être undefined si l'utilisateur n'a pas fourni de photo
      if (files.photo) {
        // Uploader le fichier dans GridFS
        // Cette fonction stocke le fichier dans MongoDB et retourne les métadonnées
        const storedPhoto = await this.uploadFile(
          files.photo, // Le fichier image (ex: File { originalname: "photo.jpg", buffer: [...] })
          ownerId, // ID du propriétaire
          ownerRole, // Rôle du propriétaire
          'photo', // Type de fichier (pour savoir que c'est une photo de profil)
        );
        
        // Ajouter l'ID du fichier à la liste (pour pouvoir le supprimer en cas d'erreur)
        uploadedIds.push(storedPhoto.fileId);
        
        // Stocker les métadonnées de la photo dans l'objet media
        media.photoFileId = storedPhoto.fileId; // ID unique du fichier dans GridFS
        media.photoMimeType = storedPhoto.mimeType; // Type MIME (ex: "image/jpeg", "image/png")
        media.photoOriginalName = storedPhoto.originalName; // Nom original du fichier (ex: "photo.jpg")
        media.photoLength = storedPhoto.length; // Taille du fichier en octets (ex: 50000 = 50 KB)
        media.photoUploadDate = storedPhoto.uploadDate; // Date d'upload (ex: Date("2024-01-15"))
      }

      // ÉTAPE 3 : Uploader le document (CV) si il est fourni
      // Même principe que pour la photo
      if (files.document) {
        // Uploader le document dans GridFS
        const storedDocument = await this.uploadFile(
          files.document, // Le fichier document (ex: File { originalname: "cv.pdf", buffer: [...] })
          ownerId, // ID du propriétaire
          ownerRole, // Rôle du propriétaire
          'document', // Type de fichier (pour savoir que c'est un document/CV)
        );
        
        // Ajouter l'ID du fichier à la liste
        uploadedIds.push(storedDocument.fileId);
        
        // Stocker les métadonnées du document dans l'objet media
        media.documentFileId = storedDocument.fileId; // ID unique du fichier
        media.documentMimeType = storedDocument.mimeType; // Type MIME (ex: "application/pdf")
        media.documentOriginalName = storedDocument.originalName; // Nom original (ex: "cv.pdf")
        media.documentLength = storedDocument.length; // Taille en octets
        media.documentUploadDate = storedDocument.uploadDate; // Date d'upload
      }

      // ÉTAPE 4 : Retourner les métadonnées des fichiers uploadés
      // Cet objet sera stocké dans le document utilisateur (acteur ou agence)
      // pour pouvoir récupérer les fichiers plus tard
      return media;
    } catch (error) {
      // En cas d'erreur, supprimer tous les fichiers uploadés
      // Cela évite de laisser des fichiers orphelins dans GridFS
      // Exemple : Si la photo a été uploadée mais que le document a échoué,
      // on supprime aussi la photo pour ne pas gaspiller de l'espace
      await this.deleteMany(uploadedIds);
      // Relancer l'erreur pour que le code appelant puisse la gérer
      throw error;
    }
  }

  async updateUserMedia(params: {
    ownerId: Types.ObjectId;
    ownerRole: Role;
    files: MediaFilesPayload;
    currentMedia?: UserMediaMetadata;
  }): Promise<{ media: UserMediaMetadata; deletedFileIds: (Types.ObjectId | string | undefined)[] }> {
    const { ownerId, ownerRole, files, currentMedia } = params;
    const updatedMedia: UserMediaMetadata = currentMedia
      ? { ...currentMedia }
      : {};
    const deletedFileIds: (Types.ObjectId | string | undefined)[] = [];

    if (files.photo) {
      const storedPhoto = await this.uploadFile(
        files.photo,
        ownerId,
        ownerRole,
        'photo',
      );
      deletedFileIds.push(currentMedia?.photoFileId);
      updatedMedia.photoFileId = storedPhoto.fileId;
      updatedMedia.photoMimeType = storedPhoto.mimeType;
      updatedMedia.photoOriginalName = storedPhoto.originalName;
      updatedMedia.photoLength = storedPhoto.length;
      updatedMedia.photoUploadDate = storedPhoto.uploadDate;
    }

    if (files.document) {
      const storedDocument = await this.uploadFile(
        files.document,
        ownerId,
        ownerRole,
        'document',
      );
      deletedFileIds.push(currentMedia?.documentFileId);
      updatedMedia.documentFileId = storedDocument.fileId;
      updatedMedia.documentMimeType = storedDocument.mimeType;
      updatedMedia.documentOriginalName = storedDocument.originalName;
      updatedMedia.documentLength = storedDocument.length;
      updatedMedia.documentUploadDate = storedDocument.uploadDate;
    }

    return { media: updatedMedia, deletedFileIds };
  }

  async addGalleryPhotos(params: {
    ownerId: Types.ObjectId;
    ownerRole: Role;
    files: Express.Multer.File[];
  }): Promise<GalleryFileMetadata[]> {
    const { ownerId, ownerRole, files } = params;
    if (!files.length) {
      return [];
    }

    const storedMetadata: GalleryFileMetadata[] = [];
    const createdFileIds: Types.ObjectId[] = [];

    try {
      for (const file of files) {
        const storedFile = await this.uploadFile(
          file,
          ownerId,
          ownerRole,
          'gallery',
        );

        createdFileIds.push(storedFile.fileId);
        storedMetadata.push({
          fileId: storedFile.fileId,
          mimeType: storedFile.mimeType,
          originalName: storedFile.originalName,
          length: storedFile.length,
          uploadDate: storedFile.uploadDate,
        });
      }

      return storedMetadata;
    } catch (error) {
      await this.deleteMany(createdFileIds);
      throw error;
    }
  }

  async storeCastingAffiche(params: {
    castingId: Types.ObjectId;
    ownerId: Types.ObjectId;
    ownerRole: Role;
    file?: Express.Multer.File;
    previousFileId?: Types.ObjectId | string | null;
  }): Promise<CastingMediaMetadata | undefined> {
    const { castingId, ownerId, ownerRole, file, previousFileId } = params;
    if (!file) {
      return undefined;
    }

    const storedPoster = await this.uploadFile(
      file,
      ownerId,
      ownerRole,
      'casting_affiche',
      {
        castingId,
      },
    );

    if (previousFileId) {
      await this.deleteFile(previousFileId);
    }

    return {
      afficheFileId: storedPoster.fileId,
      afficheMimeType: storedPoster.mimeType,
      afficheOriginalName: storedPoster.originalName,
      afficheLength: storedPoster.length,
      afficheUploadDate: storedPoster.uploadDate,
    };
  }

  async deleteMany(fileIds: (Types.ObjectId | string | undefined)[]) {
    await Promise.all(
      fileIds
        .filter((id): id is Types.ObjectId | string => Boolean(id))
        .map((id) => this.deleteFile(id)),
    );
  }

  async deleteFile(fileId: Types.ObjectId | string) {
    const objectId = this.toObjectId(fileId);
    try {
      await this.bucket.delete(objectId);
    } catch (error: any) {
      // Ignore "File not found" errors (code 26)
      if (error?.code !== 26) {
        throw error;
      }
    }
  }

  async getFileStream(
    fileId: Types.ObjectId | string,
    requester: { _id?: Types.ObjectId | string; id?: string; role?: string },
  ): Promise<{ file: GridFSFile; stream: GridFSBucketReadStream }> {
    const objectId = this.toObjectId(fileId);
    const file = await this.bucket.find({ _id: objectId }).next();

    if (!file) {
      throw new NotFoundException('Fichier non trouvé');
    }

    await this.assertCanAccess(file, requester);

    const stream = this.bucket.openDownloadStream(objectId);
    return { file, stream };
  }

  serializeMedia(media?: UserMediaMetadata) {
    if (!media) {
      return undefined;
    }

    const serializeId = (id?: Types.ObjectId) =>
      id ? String(id) : undefined;

    return {
      photoFileId: serializeId(media.photoFileId),
      photoMimeType: media.photoMimeType,
      photoOriginalName: media.photoOriginalName,
      photoLength: media.photoLength,
      photoUploadDate: media.photoUploadDate,
      documentFileId: serializeId(media.documentFileId),
      documentMimeType: media.documentMimeType,
      documentOriginalName: media.documentOriginalName,
      documentLength: media.documentLength,
      documentUploadDate: media.documentUploadDate,
      gallery: media.gallery
        ? media.gallery.map((item) => ({
            fileId: serializeId(item.fileId),
            mimeType: item.mimeType,
            originalName: item.originalName,
            length: item.length,
            uploadDate: item.uploadDate,
          }))
        : undefined,
    };
  }

  serializeCastingMedia(media?: CastingMediaMetadata) {
    if (!media) {
      return undefined;
    }

    return {
      afficheFileId: media.afficheFileId ? String(media.afficheFileId) : undefined,
      afficheMimeType: media.afficheMimeType,
      afficheOriginalName: media.afficheOriginalName,
      afficheLength: media.afficheLength,
      afficheUploadDate: media.afficheUploadDate,
    };
  }

  async storeAuditionVideo(params: {
    ownerId: Types.ObjectId;
    ownerRole: Role;
    file: Express.Multer.File;
    castingId?: Types.ObjectId;
  }): Promise<StoredFileReference> {
    const { ownerId, ownerRole, file, castingId } = params;
    return this.uploadFile(
      file,
      ownerId,
      ownerRole,
      'audition_video',
      castingId ? { castingId } : {},
    );
  }

  /**
   * Stocke un fichier Buffer dans GridFS (pour les NFTs, etc.)
   */
  async storeBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    ownerId: Types.ObjectId,
    ownerRole: Role,
    field: 'photo' | 'document' | 'casting_affiche' | 'gallery' | 'audition_video' | 'nft_image',
    extraMetadata: Record<string, unknown> = {},
  ): Promise<StoredFileReference> {
    return new Promise<StoredFileReference>((resolve, reject) => {
      const uploadStream = this.bucket.openUploadStream(filename, {
        contentType: mimeType,
        metadata: {
          ownerId,
          ownerRole,
          field,
          originalName: filename,
          ...extraMetadata,
        },
      });

      uploadStream.once('finish', async () => {
        try {
          const storedFile = await this.bucket
            .find({ _id: uploadStream.id })
            .next();

          if (!storedFile) {
            reject(new NotFoundException('Fichier importé introuvable'));
            return;
          }

          resolve({
            fileId: storedFile._id as Types.ObjectId,
            mimeType: storedFile.contentType ?? mimeType,
            originalName: storedFile.filename,
            length: storedFile.length,
            uploadDate: storedFile.uploadDate,
          });
        } catch (lookupError) {
          reject(lookupError);
        }
      });

      uploadStream.once('error', (err) => reject(err));

      Readable.from(buffer).pipe(uploadStream);
    });
  }

  /**
   * Upload un fichier dans GridFS (stockage de fichiers MongoDB)
   * 
   * GridFS divise les fichiers en "chunks" (morceaux) de 255 KB pour pouvoir stocker
   * des fichiers de grande taille dans MongoDB
   * 
   * Fonctionnement :
   * 1. Crée un stream d'upload vers GridFS
   * 2. Ajoute les métadonnées (propriétaire, type de fichier, etc.)
   * 3. Écrit le fichier dans GridFS par morceaux (streaming)
   * 4. Une fois terminé, récupère les informations du fichier stocké
   * 5. Retourne les métadonnées (ID, type, taille, date)
   * 
   * @param file - Le fichier à uploader (image, PDF, vidéo, etc.)
   * @param ownerId - L'ID du propriétaire du fichier
   * @param ownerRole - Le rôle du propriétaire (ACTEUR ou RECRUTEUR)
   * @param field - Le type de fichier (photo, document, affiche, etc.)
   * @param extraMetadata - Métadonnées supplémentaires (ex: castingId pour les affiches)
   * @returns Les métadonnées du fichier uploadé (ID, type, taille, date)
   * 
   * Exemple :
   * Input:
   *   file = File {
   *     originalname: "photo.jpg",
   *     mimetype: "image/jpeg",
   *     buffer: Buffer([0xFF, 0xD8, 0xFF, ...]), // Données binaires de l'image
   *     size: 50000
   *   }
   *   ownerId = ObjectId("507f1f77bcf86cd799439011")
   *   ownerRole = "ACTEUR"
   *   field = "photo"
   * 
   * Processus :
   *   1. Crée un stream d'upload dans GridFS
   *   2. Écrit les données du buffer dans GridFS par morceaux
   *   3. Stocke les métadonnées : { ownerId, ownerRole, field, originalName }
   *   4. Une fois terminé, récupère le fichier stocké
   * 
   * Output:
   *   {
   *     fileId: ObjectId("123"),
   *     mimeType: "image/jpeg",
   *     originalName: "photo.jpg",
   *     length: 50000,
   *     uploadDate: Date("2024-01-15")
   *   }
   */
  private async uploadFile(
    file: Express.Multer.File, // Le fichier à uploader (contient buffer, originalname, mimetype, etc.)
    ownerId: Types.ObjectId, // ID du propriétaire
    ownerRole: Role, // Rôle du propriétaire
    field: 'photo' | 'document' | 'casting_affiche' | 'gallery' | 'audition_video' | 'nft_image', // Type de fichier
    extraMetadata: Record<string, unknown> = {}, // Métadonnées supplémentaires (ex: castingId)
  ): Promise<StoredFileReference> {
    // On utilise une Promise car l'upload est asynchrone (streaming)
    // Le fichier est écrit par morceaux, donc on doit attendre que tout soit écrit
    return new Promise<StoredFileReference>((resolve, reject) => {
      // ÉTAPE 1 : Créer un stream d'upload vers GridFS
      // openUploadStream crée un "tuyau" pour écrire le fichier dans MongoDB
      // Le fichier sera divisé en chunks (morceaux) de 255 KB automatiquement
      const uploadStream = this.bucket.openUploadStream(file.originalname, {
        contentType: file.mimetype, // Type MIME du fichier (ex: "image/jpeg", "application/pdf")
        metadata: {
          // Métadonnées stockées avec le fichier dans GridFS
          // Ces métadonnées permettent de savoir qui possède le fichier et quel type c'est
          ownerId, // ID du propriétaire (ex: ObjectId("507f1f77bcf86cd799439011"))
          ownerRole, // Rôle du propriétaire (ACTEUR ou RECRUTEUR)
          field, // Type de fichier (photo, document, affiche, etc.)
          originalName: file.originalname, // Nom original du fichier (ex: "photo.jpg")
          ...extraMetadata, // Métadonnées supplémentaires (ex: { castingId: ObjectId("...") })
        },
      });

      // ÉTAPE 2 : Quand l'upload est terminé (événement 'finish')
      // 'finish' est déclenché quand toutes les données ont été écrites dans GridFS
      uploadStream.once('finish', async () => {
        try {
          // Récupérer le fichier stocké dans GridFS pour obtenir ses informations complètes
          // uploadStream.id contient l'ID du fichier qui vient d'être créé
          const storedFile = await this.bucket
            .find({ _id: uploadStream.id }) // Chercher le fichier par son ID
            .next(); // Récupérer le premier résultat

          // Vérifier que le fichier a bien été trouvé
          // Normalement, il devrait toujours exister car on vient de le créer
          if (!storedFile) {
            reject(new NotFoundException('Fichier importé introuvable'));
            return;
          }

          // ÉTAPE 3 : Retourner les métadonnées du fichier uploadé
          // Ces métadonnées seront stockées dans le document utilisateur ou casting
          // pour pouvoir récupérer le fichier plus tard
          resolve({
            fileId: storedFile._id as Types.ObjectId, // ID unique du fichier dans GridFS
            mimeType: storedFile.contentType ?? file.mimetype, // Type MIME (ex: "image/jpeg")
            originalName: storedFile.filename, // Nom du fichier (ex: "photo.jpg")
            length: storedFile.length, // Taille du fichier en octets (ex: 50000 = 50 KB)
            uploadDate: storedFile.uploadDate, // Date d'upload (ex: Date("2024-01-15"))
          });
        } catch (lookupError) {
          // Si une erreur se produit lors de la récupération du fichier
          reject(lookupError);
        }
      });

      // ÉTAPE 4 : Gérer les erreurs pendant l'upload
      // Si une erreur se produit pendant l'écriture du fichier (ex: problème de connexion)
      // L'événement 'error' est déclenché
      uploadStream.once('error', (err) => reject(err));

      // ÉTAPE 5 : Écrire le fichier dans GridFS par morceaux (streaming)
      // Readable.from(file.buffer) convertit le buffer en stream lisible
      // .pipe(uploadStream) envoie les données du buffer vers GridFS par morceaux
      // 
      // Exemple :
      //   file.buffer = Buffer([0xFF, 0xD8, 0xFF, ...]) // 50 KB de données
      //   GridFS divise en chunks de 255 KB (si le fichier est plus petit, un seul chunk)
      //   Chaque chunk est écrit dans MongoDB progressivement
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  private toObjectId(id: Types.ObjectId | string): Types.ObjectId {
    return id instanceof Types.ObjectId ? id : new Types.ObjectId(String(id));
  }

  private async assertCanAccess(
    file: GridFSFile,
    requester: { _id?: Types.ObjectId | string; id?: string; role?: string },
  ) {
    const fileField = file.metadata?.field as string | undefined;
    
    // Les images NFT sont accessibles publiquement
    if (fileField === 'nft_image') {
      return; // Accès public autorisé
    }

    // Les affiches de casting sont accessibles publiquement
    // car les castings sont publics (routes @Public()) et les affiches sont nécessaires pour leur visualisation
    if (fileField === 'casting_affiche') {
      return; // Accès public autorisé
    }

    // Extraire les IDs avec normalisation
    const requesterId = requester?._id
      ? String(requester._id).trim()
      : requester?.id
        ? String(requester.id).trim()
        : undefined;
    const requesterRole: Role | undefined = requester?.role as Role | undefined;
    const ownerRole = file.metadata?.ownerRole as Role | undefined;
    const ownerId = file.metadata?.ownerId
      ? String(file.metadata.ownerId).trim()
      : undefined;

    // Logs de diagnostic pour déboguer les erreurs 403
    console.log('[MediaService] Vérification accès fichier:', {
      fileId: String(file._id),
      fileField: fileField,
      ownerId: ownerId,
      ownerRole: ownerRole,
      requesterId: requesterId,
      requesterRole: requesterRole,
      requesterObject: {
        _id: requester?._id ? String(requester._id) : undefined,
        id: requester?.id,
        role: requester?.role,
      },
    });

    // Les admins ont accès à tous les fichiers
    if (requesterRole === Role.ADMIN) {
      return;
    }

    // Les vidéos d'audition sont accessibles au propriétaire du casting (recruteur) et à l'acteur propriétaire
    if (fileField === 'audition_video') {
      // Vérifier que l'utilisateur est authentifié (a un ID)
      if (!requesterId) {
        throw new ForbiddenException('Authentification requise pour accéder à ce fichier');
      }
      // L'acteur propriétaire peut accéder à sa vidéo
      const ownerId = file.metadata?.ownerId
        ? String(file.metadata.ownerId)
        : undefined;
      if (ownerId && requesterId && ownerId === requesterId) {
        return;
      }
      // Les recruteurs peuvent accéder aux vidéos d'audition des candidatures de leurs castings
      if (requesterRole === Role.RECRUTEUR && ownerRole === Role.ACTEUR) {
        // Vérifier que le recruteur est propriétaire du casting
        const castingId = file.metadata?.castingId
          ? String(file.metadata.castingId)
          : undefined;
        if (castingId) {
          // Vérifier si le recruteur est propriétaire de ce casting
          const casting = await this.castingModel.findById(castingId).exec();
          if (casting && casting.recruteur.toString() === requesterId) {
            return; // Le recruteur est propriétaire du casting
          }
          // Si le casting existe mais le recruteur n'est pas propriétaire, refuser
          throw new ForbiddenException('Accès refusé : vous n\'êtes pas propriétaire de ce casting');
        }
        // Si pas de castingId dans les métadonnées (vidéo uploadée avant cette modification),
        // on autorise quand même l'accès aux recruteurs authentifiés pour la rétrocompatibilité
        // La vérification de propriété du casting est faite dans getCandidateVideo avant l'appel à getFileStream
        return;
      }
      // Les admins peuvent accéder à toutes les vidéos
      if (requesterRole === (Role.ADMIN as Role)) {
        return;
      }
      throw new ForbiddenException('Accès refusé à cette vidéo d\'audition');
    }

    // Les médias des acteurs (photo de profil, galerie, CV) sont accessibles publiquement
    // car les profils des acteurs sont publics pour permettre aux recruteurs de les évaluer
    if (ownerRole === Role.ACTEUR) {
      console.log('[MediaService] ✅ Accès public autorisé: Média acteur');
      return; // Accès public autorisé pour tous les médias des acteurs
    }

    // Les photos de profil des agences sont accessibles à tous les utilisateurs authentifiés
    // car les informations des agences sont publiques dans les castings
    if (fileField === 'photo' && ownerRole === Role.RECRUTEUR) {
      // Vérifier que l'utilisateur est authentifié (a un ID)
      if (!requesterId) {
        throw new ForbiddenException('Authentification requise pour accéder à ce fichier');
      }
      return; // Autoriser l'accès aux photos de profil des agences
    }

    // Pour les autres fichiers (non acteurs, non agences), 
    // seul le propriétaire peut y accéder
    if (!ownerId || !requesterId) {
      console.error('[MediaService] ERREUR: ID manquant', {
        hasOwnerId: !!ownerId,
        hasRequesterId: !!requesterId,
        ownerId: ownerId,
        requesterId: requesterId,
        fileField: fileField,
        ownerRole: ownerRole,
        requesterRole: requesterRole,
      });
      throw new ForbiddenException('Accès refusé à ce fichier');
    }

    // Comparaison normalisée des IDs
    if (ownerId !== requesterId) {
      console.error('[MediaService] ERREUR: IDs ne correspondent pas', {
        ownerId: ownerId,
        requesterId: requesterId,
        ownerIdLength: ownerId.length,
        requesterIdLength: requesterId.length,
        ownerIdType: typeof ownerId,
        requesterIdType: typeof requesterId,
        areEqual: ownerId === requesterId,
        fileField: fileField,
        ownerRole: ownerRole,
        requesterRole: requesterRole,
      });
      throw new ForbiddenException('Accès refusé à ce fichier');
    }

    console.log('[MediaService] ✅ Accès autorisé: Propriétaire du fichier');
  }
}


