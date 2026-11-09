import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  Hbar,
  AccountId,
  TokenMintTransaction,
  FileCreateTransaction,
  TransferTransaction,
  NftId,
  TokenId,
} from '@hashgraph/sdk';

@Injectable()
export class HederaService implements OnModuleInit {
  private readonly logger = new Logger(HederaService.name);
  private client: Client | null = null;
  private operatorId: AccountId | null = null;
  private operatorKey: PrivateKey | null = null;
  private treasuryAccountId: AccountId | null = null;
  private treasuryPrivateKey: PrivateKey | null = null;
  private isConfigured = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Configuration depuis les variables d'environnement
    const accountId = this.configService.get<string>('HEDERA_ACCOUNT_ID');
    const privateKey = this.configService.get<string>('HEDERA_PRIVATE_KEY');
    const network = this.configService.get<string>('HEDERA_NETWORK') || 'testnet';

    if (!accountId || !privateKey) {
      this.logger.warn(
        'Hedera credentials not configured. NFT minting will be disabled. Set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in .env',
      );
      return;
    }

    try {
      this.operatorId = AccountId.fromString(accountId);
      
      // Parser la clé privée (supporte les formats HEX avec 0x et sans)
      let parsedKey = privateKey.trim();
      if (parsedKey.startsWith('0x')) {
        parsedKey = parsedKey.substring(2); // Retirer le préfixe 0x
      }
      
      // Essayer de parser comme clé ECDSA (format HEX) - méthode recommandée pour les clés HEX
      try {
        this.operatorKey = PrivateKey.fromStringECDSA(parsedKey);
        this.logger.log('Private key parsed as ECDSA (HEX format)');
      } catch (e) {
        // Si ça échoue, essayer le format standard (DER)
        try {
          this.operatorKey = PrivateKey.fromString(privateKey);
          this.logger.log('Private key parsed as standard format (DER)');
        } catch (e2) {
          this.logger.error('Failed to parse private key. Make sure it is in HEX format (with or without 0x prefix) or DER format.');
          throw new Error('Invalid private key format');
        }
      }
      
      this.treasuryAccountId = this.operatorId;
      this.treasuryPrivateKey = this.operatorKey;

      
      this.client = Client.forTestnet();
      

      this.client.setOperator(this.operatorId, this.operatorKey);
      this.isConfigured = true;
      this.logger.log(`Hedera client initialized for ${network}`);
    } catch (error) {
      this.logger.error('Error initializing Hedera client:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Vérifie si Hedera est configuré
   */
  isHederaConfigured(): boolean {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Crée un token NFT sur Hedera (une seule fois, puis réutilisé)
   */
  async createNFTSeriesIfNotExists(): Promise<string> {
    if (!this.isHederaConfigured()) {
      throw new Error('Hedera is not configured. Please set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY');
    }

    const existingTokenId = this.configService.get<string>('HEDERA_TOKEN_ID');
    if (existingTokenId) {
      this.logger.log(`Using existing NFT Token ID: ${existingTokenId}`);
      return existingTokenId;
    }

    try {
      if (!this.client || !this.treasuryAccountId || !this.treasuryPrivateKey) {
        throw new Error('Hedera client not initialized');
      }

      // Créer la transaction avec la supply key (nécessaire pour mint des NFTs)
      const transaction = await new TokenCreateTransaction()
        .setTokenName('CastMate Training NFT')
        .setTokenSymbol('CMT')
        .setTokenType(TokenType.NonFungibleUnique)
        .setTreasuryAccountId(this.treasuryAccountId)
        .setSupplyKey(this.treasuryPrivateKey.publicKey) // Supply key nécessaire pour mint des NFTs
        .setInitialSupply(0)
        .setSupplyType(TokenSupplyType.Infinite)
        .setMaxTransactionFee(new Hbar(30))
        .freezeWith(this.client);

      // Signer avec la clé du treasury account
      // Note: La supply key est la même que le treasury, donc une seule signature suffit
      const signTx = await transaction.sign(this.treasuryPrivateKey);
      const txResponse = await signTx.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);
      const tokenId = receipt.tokenId?.toString();

      if (!tokenId) {
        throw new Error('Failed to create NFT token');
      }

      this.logger.log(`NFT Series created with Token ID: ${tokenId}`);
      this.logger.warn(
        `IMPORTANT: Add HEDERA_TOKEN_ID=${tokenId} to your .env file to reuse this token`,
      );
      return tokenId;
    } catch (error) {
      this.logger.error('Error creating NFT series:', error);
      throw error;
    }
  }

  /**
   * Upload une image ou fichier sur Hedera File Service
   * Limite de taille : ~1-2 MB par fichier
   * Avec retry automatique en cas d'échec
   */
  async uploadImageToHedera(imageBuffer: Buffer, mimeType: string, retries = 3): Promise<string> {
    if (!this.isHederaConfigured() || !this.client || !this.operatorKey) {
      throw new Error('Hedera is not configured');
    }

    const fileSizeKB = Math.round(imageBuffer.length / 1024);
    this.logger.log(`Uploading file to Hedera File Service (${fileSizeKB} KB, ${mimeType})...`);

    // Hedera File Service peut gérer des fichiers jusqu'à ~1-2 MB
    if (imageBuffer.length > 2 * 1024 * 1024) {
      this.logger.warn(`File size (${fileSizeKB} KB) is large, upload may take time or fail`);
    }

    // Calculer les frais en fonction de la taille du fichier
    // Minimum 20 Hbar, plus pour les gros fichiers
    const baseFee = 20;
    const sizeBasedFee = Math.ceil(imageBuffer.length / (100 * 1024)); // 1 Hbar par 100 KB
    const maxFee = Math.max(baseFee, sizeBasedFee);
    
    // Timeout pour les transactions (en millisecondes)
    // Plus long pour les gros fichiers ou réseau instable
    const baseTimeout = 10000; // 10 secondes de base
    const sizeBasedTimeout = Math.ceil(imageBuffer.length / (10 * 1024)) * 1000; // +1s par 10 KB
    const transactionTimeout = Math.min(Math.max(baseTimeout, sizeBasedTimeout), 60000); // Max 60s
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (attempt > 1) {
          this.logger.log(`Retry attempt ${attempt}/${retries} for file upload...`);
          // Attendre plus longtemps entre les tentatives (backoff exponentiel)
          const backoffDelay = Math.min(2000 * Math.pow(2, attempt - 2), 30000); // Max 30s
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }

        this.logger.log(`Attempting upload with max fee: ${maxFee} Hbar (timeout: ${transactionTimeout}ms)`);

        // Vérifier que client et operatorKey sont définis
        if (!this.client || !this.operatorKey) {
          throw new Error('Hedera client or operator key not initialized');
        }

        // Créer une promesse avec timeout
        const uploadPromise = (async () => {
          const transaction = await new FileCreateTransaction()
            .setContents(imageBuffer)
            .setKeys([this.operatorKey!])
            .setMaxTransactionFee(new Hbar(maxFee))
            .freezeWith(this.client!);

          const signTx = await transaction.sign(this.operatorKey!);
          const txResponse = await signTx.execute(this.client!);
          
          // Attendre avec timeout pour le receipt
          const receiptPromise = txResponse.getReceipt(this.client!);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction timeout')), transactionTimeout)
          );
          
          const receipt = await Promise.race([receiptPromise, timeoutPromise]) as any;
          return receipt;
        })();

        const receipt = await uploadPromise;
        const fileId = receipt.fileId?.toString();

        if (!fileId) {
          throw new Error('Failed to upload file to Hedera - no file ID returned');
        }

        this.logger.log(`✅ File uploaded to Hedera File Service: ${fileId} (${fileSizeKB} KB)`);
        return fileId;
      } catch (error) {
        const isLastAttempt = attempt === retries;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (isLastAttempt) {
          this.logger.error(`❌ Failed to upload file to Hedera after ${retries} attempts:`, errorMessage);
          if (error instanceof Error && error.stack) {
            this.logger.error('Error stack:', error.stack);
          }
          throw new Error(`Failed to upload file to Hedera File Service after ${retries} attempts: ${errorMessage}`);
        } else {
          this.logger.warn(`⚠️ Upload attempt ${attempt} failed, retrying... Error: ${errorMessage}`);
        }
      }
    }

    // Ne devrait jamais arriver ici, mais TypeScript le demande
    throw new Error('Failed to upload file to Hedera File Service');
  }

  /**
   * Mint un NFT avec métadonnées
   * Accepte soit un CID IPFS (Buffer), soit une string JSON (max 100 bytes)
   */
  async mintNFT(
    tokenId: string,
    metadata: string | Buffer, // CID IPFS (Buffer) ou métadonnées JSON string (doit être < 100 bytes)
  ): Promise<{ serialNumber: string; transactionId: string }> {
    if (!this.isHederaConfigured() || !this.client || !this.treasuryPrivateKey) {
      throw new Error('Hedera is not configured');
    }

    try {
      let metadataBuffer: Buffer;
      let metadataDescription: string;

      // Si c'est un Buffer (CID IPFS), l'utiliser directement
      if (Buffer.isBuffer(metadata)) {
        metadataBuffer = metadata;
        metadataDescription = `IPFS CID: ${metadata.toString('utf8')}`;
        this.logger.log(`Minting NFT with IPFS CID: ${metadata.toString('utf8')}`);
      } else {
        // Sinon, c'est une string JSON (format classique)
        const metadataJson = metadata as string;
        
        // Vérifier la taille des métadonnées (limite 100 bytes sur Hedera)
        const metadataSize = Buffer.byteLength(metadataJson, 'utf8');
        if (metadataSize > 100) {
          this.logger.warn(
            `Metadata size (${metadataSize} bytes) exceeds Hedera limit (100 bytes). Truncating...`,
          );
          // Tronquer si nécessaire
          const truncated = metadataJson.substring(0, 90); // Laisser de la marge
          const finalMetadata = truncated + '"}'; // Fermer le JSON
          metadataBuffer = Buffer.from(finalMetadata, 'utf8');
          metadataDescription = `JSON (truncated): ${finalMetadata}`;
        } else {
          metadataBuffer = Buffer.from(metadataJson, 'utf8');
          metadataDescription = `JSON: ${metadataJson}`;
        }
        
        this.logger.log(`Minting NFT with metadata (${Buffer.byteLength(metadataBuffer, 'utf8')} bytes): ${metadataDescription}`);
      }

      // Mint le NFT avec les métadonnées
      const transaction = await new TokenMintTransaction()
        .setTokenId(tokenId)
        .setMetadata([metadataBuffer])
        .setMaxTransactionFee(new Hbar(30))
        .freezeWith(this.client);

      const signTx = await transaction.sign(this.treasuryPrivateKey);
      const txResponse = await signTx.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);
      const transactionId = txResponse.transactionId.toString();

      // Récupérer le serial number
      const serialNumber = receipt.serials?.[0]?.toString();

      if (!serialNumber) {
        throw new Error('Failed to mint NFT - no serial number returned');
      }

      this.logger.log(`NFT minted with Serial Number: ${serialNumber}, Transaction: ${transactionId}`);

      return {
        serialNumber,
        transactionId,
      };
    } catch (error) {
      this.logger.error('Error minting NFT:', error);
      throw error;
    }
  }

  /**
   * Transfère un NFT à un utilisateur (compte HashPack)
   * @param tokenId Token ID du NFT (ex: "0.0.1234567")
   * @param serialNumber Numéro de série du NFT (ex: "1")
   * @param recipientAccountId Compte destinataire (ex: "0.0.7654321")
   * @returns Transaction ID du transfert
   */
  async transferNFT(
    tokenId: string,
    serialNumber: string,
    recipientAccountId: string,
  ): Promise<string> {
    if (!this.isHederaConfigured() || !this.client || !this.treasuryPrivateKey || !this.treasuryAccountId) {
      throw new Error('Hedera is not configured');
    }

    try {
      this.logger.log(
        `Transferring NFT ${tokenId} serial ${serialNumber} to ${recipientAccountId}...`,
      );

      // Créer l'ID du NFT
      const nftId = new NftId(TokenId.fromString(tokenId), parseInt(serialNumber, 10));
      const recipientId = AccountId.fromString(recipientAccountId);

      // Créer la transaction de transfert
      const transaction = await new TransferTransaction()
        .addNftTransfer(nftId, this.treasuryAccountId, recipientId)
        .setMaxTransactionFee(new Hbar(10))
        .freezeWith(this.client);

      // Signer avec la clé du treasury (propriétaire actuel du NFT)
      const signTx = await transaction.sign(this.treasuryPrivateKey);
      const txResponse = await signTx.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);
      const transactionId = txResponse.transactionId.toString();

      this.logger.log(
        `✅ NFT ${tokenId} serial ${serialNumber} successfully transferred to ${recipientAccountId}`,
      );
      this.logger.log(`   Transaction ID: ${transactionId}`);

      return transactionId;
    } catch (error) {
      this.logger.error('Error transferring NFT:', error);
      if (error instanceof Error) {
        this.logger.error('Error message:', error.message);
      }
      throw error;
    }
  }
}

