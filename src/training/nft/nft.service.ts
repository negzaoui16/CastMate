import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Types } from 'mongoose';
import { HederaService } from './hedera.service';
import { MediaService } from '../../media/media.service';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class NFTService implements OnModuleInit {
  private readonly logger = new Logger(NFTService.name);
  private readonly nftImagesPath: string;
  // Cache des File IDs GridFS pour les images de base (1.png, 2.png, 3.png)
  private baseImageFileIds: Map<number, Types.ObjectId> = new Map();

  constructor(
    private hederaService: HederaService,
    private configService: ConfigService,
    private mediaService: MediaService,
  ) {
    // Chemin vers les images NFT
    this.nftImagesPath = join(process.cwd(), 'public', 'nft-images');
  }

  /**
   * Précharge les images NFT de base (1.png, 2.png, 3.png) dans MongoDB GridFS au démarrage
   */
  async onModuleInit() {
    this.logger.log('Initializing NFT Service...');
    
    // Précharger les images de base dans GridFS (optionnel, pour optimisation)
    try {
      await this.preloadBaseImages();
    } catch (error) {
      this.logger.warn('Failed to preload base images in GridFS (will be loaded on demand):', error);
    }
  }

  /**
   * Précharge les images NFT de base dans GridFS
   */
  private async preloadBaseImages() {
    const baseLevels = [1, 2, 3]; // Les 3 premiers niveaux
    const systemOwnerId = new Types.ObjectId('000000000000000000000000');
    
    for (const niveau of baseLevels) {
      try {
        const imagePath = join(this.nftImagesPath, `${niveau}.png`);
        if (!existsSync(imagePath)) {
          this.logger.warn(`Base image not found for level ${niveau}: ${imagePath}`);
          continue;
        }

        const imageBuffer = readFileSync(imagePath);
        const storedFile = await this.mediaService.storeBuffer(
          imageBuffer,
          `nft-base-level-${niveau}.png`,
          'image/png',
          systemOwnerId,
          Role.ADMIN,
          'nft_image',
          {
            niveau,
            isBaseImage: true,
            preloaded: true,
          },
        );

        this.baseImageFileIds.set(niveau, storedFile.fileId);
        this.logger.log(`✅ Preloaded base image for level ${niveau} in GridFS: ${storedFile.fileId}`);
      } catch (error) {
        this.logger.warn(`Failed to preload base image for level ${niveau}:`, error);
      }
    }
  }

  /**
   * Récupère le File ID GridFS pour une image de base (si préchargée)
   */
  getBaseImageFileId(niveau: number): Types.ObjectId | undefined {
    return this.baseImageFileIds.get(niveau);
  }

  /**
   * Génère l'URL de l'image de la carte NFT basée sur le niveau
   * Pour l'instant, on utilise les images locales
   */
  getCardImagePath(niveau: number): string {
    // Vérifier si l'image existe pour ce niveau
    const imagePath = join(this.nftImagesPath, `${niveau}.png`);
    try {
      // Vérifier que le fichier existe
      readFileSync(imagePath);
      return imagePath;
    } catch (error) {
      this.logger.warn(`NFT image not found for level ${niveau} at ${imagePath}`);
      // Retourner une image par défaut ou null
      return imagePath; // On retourne quand même le chemin, l'erreur sera gérée plus tard
    }
  }

  /**
   * Lit l'image NFT depuis le système de fichiers
   */
  async getCardImageBuffer(niveau: number): Promise<Buffer> {
    const imagePath = this.getCardImagePath(niveau);
    try {
      return readFileSync(imagePath);
    } catch (error) {
      this.logger.error(`Error reading NFT image for level ${niveau}:`, error);
      throw new Error(`NFT image not found for level ${niveau}`);
    }
  }

  /**
   * Génère l'URL publique de l'image (à adapter selon votre hébergement)
   */
  generateCardImageUrl(niveau: number, score: number): string {
    // Option 1: Utiliser une URL statique si les images sont hébergées
    const baseUrl =
      this.configService.get<string>('NFT_IMAGE_BASE_URL') ||
      this.configService.get<string>('API_BASE_URL') ||
      'http://localhost:3000';

    // Option 2: Utiliser un endpoint pour servir les images
    return `${baseUrl}/training/nft-images/${niveau}.png`;
  }

  /**
   * Crée les métadonnées complètes du NFT au format HIP-412 (Token Metadata JSON Schema V2)
   * L'imageUrl doit pointer vers Hedera File Service pour être accessible par HashScan/HashPack
   */
  createFullNFTMetadata(
    niveau: number,
    score: number,
    imageUrl: string, // URL Hedera File Service (recommandé) ou GridFS (fallback)
    acteurName: string,
    imageFileId: Types.ObjectId, // File ID dans GridFS (pour référence interne)
  ) {
    // Vérifier si l'URL pointe vers Hedera File Service (recommandé pour HashScan/HashPack)
    const isHederaUrl = imageUrl.includes('hashscan.io') || imageUrl.includes('hedera');
    if (!isHederaUrl && !imageUrl.includes('/media/')) {
      this.logger.warn(`Image URL may not be accessible publicly: ${imageUrl}`);
    }

    // Convertir l'URL HashScan en format hedera:// si nécessaire (selon HIP-412)
    // HIP-412 recommande hedera:// pour Hedera File Service, mais HashScan URLs fonctionnent aussi
    // On garde le format HashScan car c'est plus accessible et fonctionne avec tous les wallets
    let imageUri = imageUrl;
    if (isHederaUrl && imageUrl.includes('hashscan.io')) {
      // Extraire le File ID depuis l'URL HashScan pour créer l'URI hedera://
      const fileIdMatch = imageUrl.match(/file\/(0\.0\.\d+)/);
      if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        // Format hedera:// selon HIP-412 (mais on garde aussi l'URL HashScan en fallback)
        // Les wallets modernes supportent les deux formats
        imageUri = imageUrl; // On garde l'URL HashScan car plus universelle
      }
    }

    // Timestamp Unix en secondes pour l'attribut Date (selon HIP-412)
    const createdAtTimestamp = Math.floor(Date.now() / 1000);

    const metadata: any = {
      name: `CastMate Training Card - Niveau ${niveau}`,
      description: `Carte NFT obtenue après avoir complété le niveau ${niveau} avec un score de ${score}%`,
      type: 'image/png',
      image: imageUri, // URI vers l'image sur Hedera File Service (format HIP-412)
      format: 'HIP412@2.0.0',
      creator: 'CastMate Platform',
      attributes: [
        { trait_type: 'Niveau', value: niveau },
        { trait_type: 'Score', value: score, display_type: 'number', max_value: 100 },
        { trait_type: 'Acteur', value: acteurName },
        { trait_type: 'Date', value: createdAtTimestamp, display_type: 'datetime' }, // Timestamp Unix en secondes
        { trait_type: 'Plateforme', value: 'CastMate' },
      ],
      // L'image sur Hedera File Service (accessible publiquement)
      // Selon HIP-412, le champ 'image' peut servir de preview, et le fichier haute résolution
      // est dans 'files' avec is_default_file: true
      files: [
        {
          uri: imageUri, // URI vers l'image sur Hedera File Service
          type: 'image/png',
          is_default_file: true, // Fichier par défaut pour l'affichage
        },
      ],
      // Propriétés additionnelles (selon HIP-412, pour informations supplémentaires)
      properties: {
        gridfsFileId: imageFileId.toString(), // File ID MongoDB GridFS (référence interne)
        storage: isHederaUrl ? 'hedera_file_service' : 'mongodb_gridfs',
      },
    };

    return metadata;
  }

  /**
   * Crée les métadonnées minimales pour Hedera (limite 100 bytes)
   * Format compact : {"n":niveau,"s":score}
   */
  createHederaMetadata(niveau: number, score: number): string {
    // Format minimal pour respecter la limite de 100 bytes
    const metadata = JSON.stringify({ n: niveau, s: score });
    
    // Vérifier la taille (doit être < 100 bytes)
    if (Buffer.byteLength(metadata, 'utf8') > 100) {
      this.logger.warn(`Metadata size: ${Buffer.byteLength(metadata, 'utf8')} bytes, truncating...`);
      // Si trop long, utiliser un format encore plus compact
      return JSON.stringify({ n: niveau, s: score });
    }
    
    return metadata;
  }

  /**
   * Mint un NFT pour une session d'entraînement réussie
   */
  async mintTrainingNFT(
    acteurId: string,
    acteurName: string,
    niveau: number,
    score: number,
  ): Promise<{
    tokenId: string;
    serialNumber: string;
    transactionId: string;
    imageUrl: string;
    metadataUrl: string;
  }> {
    try {
      // Vérifier que Hedera est configuré
      if (!this.hederaService.isHederaConfigured()) {
        this.logger.warn(
          'Hedera not configured, creating mock NFT data (for development)',
        );
        // Mode développement : retourner des données mock avec un tokenId unique
        const imageUrl = this.generateCardImageUrl(niveau, score);
        const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
        return {
          tokenId: `MOCK_TOKEN_${uniqueId}`,
          serialNumber: `MOCK_${uniqueId}`,
          transactionId: `MOCK_TX_${uniqueId}`,
          imageUrl,
          metadataUrl: imageUrl.replace('.png', '.json'),
        };
      }

      // Créer ou récupérer le token ID de la série NFT
      const tokenId = await this.hederaService.createNFTSeriesIfNotExists();

      // 1. Lire l'image depuis le système de fichiers (nécessaire pour GridFS et Hedera)
      const imageBuffer = await this.getCardImageBuffer(niveau);
      const imageSizeKB = Math.round(imageBuffer.length / 1024);
      this.logger.log(`Processing NFT image (${imageSizeKB} KB) for level ${niveau}...`);

      // 2. Vérifier si l'image de base est déjà dans GridFS (préchargée)
      let imageFileId: Types.ObjectId | undefined = this.getBaseImageFileId(niveau);
      let imageUrl: string;
      const baseUrl = this.configService.get<string>('API_BASE_URL') || 'http://localhost:3000';

      if (imageFileId) {
        // Utiliser l'image préchargée depuis GridFS
        imageUrl = `${baseUrl}/media/${imageFileId}`;
        this.logger.log(`✅ Using preloaded base image from MongoDB GridFS for level ${niveau}: ${imageFileId}`);
        this.logger.log(`   Image URL (GridFS): ${imageUrl}`);
      } else {
        // Stocker l'image dans MongoDB GridFS (OBLIGATOIRE)
        try {
          // Utiliser un ObjectId temporaire pour l'owner (les images NFT sont publiques)
          const systemOwnerId = new Types.ObjectId('000000000000000000000000');
          const storedFile = await this.mediaService.storeBuffer(
            imageBuffer,
            `nft-level-${niveau}-${acteurId}-${Date.now()}.png`, // Nom unique pour éviter les conflits
            'image/png',
            systemOwnerId,
            Role.ADMIN, // Les images NFT sont accessibles publiquement
            'nft_image',
            {
              niveau,
              score,
              acteurId,
              timestamp: new Date().toISOString(),
            },
          );
          imageFileId = storedFile.fileId;
          imageUrl = `${baseUrl}/media/${storedFile.fileId}`;
          this.logger.log(`✅ Image stored in MongoDB GridFS: ${imageFileId}`);
          this.logger.log(`   Image URL (GridFS): ${imageUrl}`);
          this.logger.log(`   Image size: ${imageSizeKB} KB`);
        } catch (error) {
          this.logger.error('❌ CRITICAL: Failed to store image in GridFS:', error);
          // Si l'upload GridFS échoue, on ne peut pas continuer car l'image doit être dans MongoDB
          throw new Error(`Failed to store NFT image in MongoDB GridFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 3. Charger l'URL de l'image depuis metadata.json (PostImg, etc.)
      // On n'upload PAS l'image sur Hedera File Service, on utilise directement l'URL externe
      let metadataImageUrl: string;
      
      try {
        const metadataPath = join(process.cwd(), 'public', 'nft-metadata', 'metadata.json');
        if (existsSync(metadataPath)) {
          const metadataContent = readFileSync(metadataPath, 'utf8');
          const localMetadata = JSON.parse(metadataContent);
          
          if (localMetadata.image) {
            // Utiliser l'URL de l'image depuis metadata.json (PostImg, etc.)
            metadataImageUrl = localMetadata.image;
            this.logger.log(`✅ Using image URL from metadata.json: ${metadataImageUrl}`);
            this.logger.log(`   Skipping Hedera File Service upload - using external image URL`);
          } else {
            // Fallback : utiliser GridFS si pas d'URL dans metadata.json
            metadataImageUrl = `${baseUrl}/media/${imageFileId}`;
            this.logger.warn(`⚠️ No image URL in metadata.json, using GridFS: ${metadataImageUrl}`);
          }
        } else {
          // Fallback : utiliser GridFS si le fichier n'existe pas
          metadataImageUrl = `${baseUrl}/media/${imageFileId}`;
          this.logger.warn(`⚠️ Metadata file not found, using GridFS: ${metadataImageUrl}`);
        }
      } catch (error) {
        // Fallback : utiliser GridFS en cas d'erreur
        metadataImageUrl = `${baseUrl}/media/${imageFileId}`;
        this.logger.warn(`⚠️ Error loading metadata.json, using GridFS: ${metadataImageUrl}`);
      }
      
      // IMPORTANT: imageFileId doit être défini (l'image doit être dans GridFS pour référence)
      if (!imageFileId) {
        throw new Error('Image File ID is required - image must be stored in MongoDB GridFS');
      }
      
      // S'assurer que l'URL pointe vers GridFS (pour stockage en base de données)
      const gridfsImageUrl = `${baseUrl}/media/${imageFileId}`;
      if (imageUrl !== gridfsImageUrl) {
        this.logger.warn(`Image URL was changed from GridFS to: ${imageUrl}, reverting to GridFS URL`);
        imageUrl = gridfsImageUrl;
      }
      
      // Charger les métadonnées depuis le fichier local metadata.json
      let fullMetadata: any;
      let imageUrlFromMetadata: string | null = null;
      try {
        const metadataPath = join(process.cwd(), 'public', 'nft-metadata', 'metadata.json');
        if (existsSync(metadataPath)) {
          const metadataContent = readFileSync(metadataPath, 'utf8');
          fullMetadata = JSON.parse(metadataContent);
          
          // Garder l'URL de l'image depuis le fichier metadata.json (PostImg, etc.)
          // Ne PAS la remplacer par localhost
          if (fullMetadata.image) {
            imageUrlFromMetadata = fullMetadata.image;
            this.logger.log(`✅ Using image URL from metadata.json: ${imageUrlFromMetadata}`);
          } else {
            // Si pas d'URL dans metadata.json, utiliser l'URL réelle
            fullMetadata.image = metadataImageUrl;
            imageUrlFromMetadata = metadataImageUrl;
            this.logger.log(`⚠️ No image URL in metadata.json, using: ${metadataImageUrl}`);
          }
          
          // Optionnel : mettre à jour le nom avec le niveau si nécessaire
          if (fullMetadata.name && fullMetadata.name.includes('Niveau')) {
            fullMetadata.name = fullMetadata.name.replace(/Niveau \d+/, `Niveau ${niveau}`);
          }
          
          this.logger.log(`✅ Metadata loaded from local file: ${metadataPath}`);
        } else {
          // Fallback : créer les métadonnées dynamiquement si le fichier n'existe pas
          this.logger.warn(`⚠️ Metadata file not found at ${metadataPath}, using dynamic metadata`);
          fullMetadata = this.createFullNFTMetadata(
            niveau,
            score,
            metadataImageUrl,
            acteurName,
            imageFileId,
          );
          imageUrlFromMetadata = metadataImageUrl;
        }
      } catch (error) {
        this.logger.error('Failed to load metadata from local file:', error);
        // Fallback : créer les métadonnées dynamiquement
        this.logger.warn('Using dynamic metadata as fallback');
        fullMetadata = this.createFullNFTMetadata(
          niveau,
          score,
          metadataImageUrl,
          acteurName,
          imageFileId,
        );
        imageUrlFromMetadata = metadataImageUrl;
      }

      // Upload les métadonnées complètes sur Hedera File Service
      let hederaMetadataUrl = '';
      try {
        const metadataJson = JSON.stringify(fullMetadata);
        const metadataFileId = await this.hederaService.uploadImageToHedera(
          Buffer.from(metadataJson, 'utf8'),
          'application/json',
        );
        const network = this.configService.get<string>('HEDERA_NETWORK') || 'testnet';
        hederaMetadataUrl = `https://hashscan.io/${network}/file/${metadataFileId}`;
        this.logger.log(`Metadata uploaded to Hedera File Service: ${metadataFileId}`);
      } catch (error) {
        this.logger.warn('Failed to upload metadata to Hedera File Service:', error);
      }

      // Créer les métadonnées pour le NFT (limite 100 bytes sur Hedera)
      // Priorité 1 : CID IPFS depuis variable d'environnement (hardcodé)
      // Priorité 2 : URL de l'image
      // Priorité 3 : Métadonnées minimales
      let hederaMetadata: string | Buffer = this.createHederaMetadata(niveau, score); // Fallback par défaut
      
      // Utiliser directement le CID IPFS depuis la variable d'environnement
      // Le CID pointe directement vers le fichier metadata.json sur IPFS
      const ipfsCid = this.configService.get<string>('NFT_IPFS_CID') || 'bafkreiaiototfs5gddx3gbo4hl62sgfqsunosbeoik7wdz2um7tzzmxbae';
      
      if (ipfsCid) {
        // Utiliser directement le CID IPFS (il pointe déjà vers metadata.json)
        const ipfsMetadataUrl = `ipfs://${ipfsCid}`;
        const ipfsMetadataBuffer = Buffer.from(ipfsMetadataUrl, 'utf8');
        
        // Vérifier la taille (doit être < 100 bytes)
        if (ipfsMetadataBuffer.length <= 100) {
          hederaMetadata = ipfsMetadataBuffer;
          this.logger.log(`✅ Using IPFS CID in NFT metadata (${ipfsMetadataBuffer.length} bytes): ${ipfsMetadataUrl}`);
          this.logger.log(`   This CID points directly to the metadata.json file on IPFS`);
        } else {
          this.logger.warn(`⚠️ IPFS URL too long (${ipfsMetadataBuffer.length} bytes), falling back to image URL`);
        }
      }
      
      // Si pas de CID IPFS, utiliser l'URL de l'image
      if (!ipfsCid) {
        const imageUrlForMetadata = imageUrlFromMetadata || fullMetadata.image || metadataImageUrl;
        
        // Créer un JSON simple avec juste l'URL de l'image : {"image": "https://..."}
        const simpleImageMetadata = { image: imageUrlForMetadata };
        const simpleMetadataJson = JSON.stringify(simpleImageMetadata);
        const simpleMetadataSize = Buffer.byteLength(simpleMetadataJson, 'utf8');
        
        this.logger.log(`Checking metadata size: ${simpleMetadataSize} bytes for image URL: ${imageUrlForMetadata}`);
        
        if (simpleMetadataSize <= 100) {
          hederaMetadata = simpleMetadataJson;
          this.logger.log(`✅ Using simple image URL in NFT metadata (${simpleMetadataSize} bytes)`);
          this.logger.log(`   Image URL: ${imageUrlForMetadata}`);
        } else {
          // Si l'URL est trop longue, utiliser le File ID des métadonnées complètes
          this.logger.warn(`⚠️ Image URL too long (${simpleMetadataSize} bytes), trying metadata File ID reference`);
          
          if (hederaMetadataUrl) {
            const metadataFileIdMatch = hederaMetadataUrl.match(/file\/(0\.0\.\d+)/);
            const metadataFileId = metadataFileIdMatch ? metadataFileIdMatch[1] : null;
            
            if (metadataFileId) {
              // Format compact: {"m":"fileId"} pour référencer les métadonnées complètes
              const metadataWithFileId = JSON.stringify({ m: metadataFileId });
              const size = Buffer.byteLength(metadataWithFileId, 'utf8');
              
              if (size <= 100) {
                hederaMetadata = metadataWithFileId;
                this.logger.log(`✅ Using metadata File ID reference in NFT metadata (${size} bytes): ${metadataFileId}`);
                this.logger.log(`   Full metadata available at: ${hederaMetadataUrl}`);
              } else {
                // Fallback : utiliser les métadonnées minimales
                hederaMetadata = this.createHederaMetadata(niveau, score);
                this.logger.warn(`⚠️ All metadata options too long, using minimal metadata`);
              }
            } else {
              hederaMetadata = this.createHederaMetadata(niveau, score);
            }
          } else {
            // Fallback : utiliser les métadonnées minimales
            hederaMetadata = this.createHederaMetadata(niveau, score);
            this.logger.warn(`⚠️ No metadata URL available, using minimal metadata`);
          }
        }
      }

      // Mint le NFT avec métadonnées (peut être un Buffer IPFS ou une string JSON)
      const { serialNumber, transactionId } = await this.hederaService.mintNFT(
        tokenId,
        hederaMetadata,
      );

      // Générer l'URL des métadonnées (peut être stockée sur IPFS ou Hedera File Service)
      const network = this.configService.get<string>('HEDERA_NETWORK') || 'testnet';
      const metadataUrl = `https://hashscan.io/${network}/token/${tokenId}?serial=${serialNumber}`;

      // Retourner l'URL de l'image depuis metadata.json (PostImg) si disponible
      // Sinon utiliser GridFS en fallback
      // L'URL PostImg est prioritaire car elle est accessible publiquement
      const finalImageUrl = imageUrlFromMetadata || imageUrl;
      
      this.logger.log(`✅ Final image URL for NFT: ${finalImageUrl}`);
      if (imageUrlFromMetadata) {
        this.logger.log(`   Using image URL from metadata.json (PostImg)`);
      } else {
        this.logger.warn(`   Using GridFS URL (may not be accessible publicly)`);
      }
      
      return {
        tokenId,
        serialNumber,
        transactionId,
        imageUrl: finalImageUrl, // URL depuis metadata.json (PostImg) ou Hedera/GridFS
        metadataUrl: hederaMetadataUrl || metadataUrl, // URL des métadonnées complètes sur Hedera
      };
    } catch (error) {
      this.logger.error('Error minting training NFT:', error);
      throw error;
    }
  }

  /**
   * Transfère un NFT à un utilisateur (compte HashPack)
   * @param tokenId Token ID du NFT
   * @param serialNumber Numéro de série du NFT
   * @param recipientAccountId Compte HashPack du destinataire
   * @returns Transaction ID du transfert
   */
  async transferNFTToUser(
    tokenId: string,
    serialNumber: string,
    recipientAccountId: string,
  ): Promise<string> {
    return this.hederaService.transferNFT(tokenId, serialNumber, recipientAccountId);
  }
}

