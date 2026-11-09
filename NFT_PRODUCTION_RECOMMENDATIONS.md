# 🚀 Recommandations pour la Production - Système NFT

## 📋 Vue d'ensemble

Ce document décrit les améliorations et recommandations pour déployer le système NFT en production sur Hedera Mainnet.

---

## 🔐 1. Sécurité des Clés

### ✅ Vérifications Actuelles

- ✅ `.env` est dans `.gitignore` (vérifié)
- ✅ Les clés sont chargées depuis les variables d'environnement uniquement
- ✅ Pas de clés hardcodées dans le code

### 🔒 Recommandations Production

1. **Utiliser un gestionnaire de secrets** :
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault
   - Vercel Environment Variables (si déployé sur Vercel)

2. **Rotation des clés** :
   - Créer un compte Hedera dédié pour la production
   - Limiter les permissions du compte
   - Surveiller les transactions régulièrement

3. **Séparation des environnements** :
   ```env
   # Development
   HEDERA_NETWORK=testnet
   HEDERA_ACCOUNT_ID=0.0.xxxxx
   
   # Production
   HEDERA_NETWORK=mainnet
   HEDERA_ACCOUNT_ID=0.0.yyyyy  # Compte dédié production
   ```

---

## 🖼️ 2. Stockage des Images NFT

### ⚠️ Problème Actuel

- Les images sont stockées localement (`public/nft-images/`)
- Les URLs PostImg sont utilisées (bon pour testnet, mais pas idéal pour production)
- Les URLs `localhost:3000` ne sont pas accessibles publiquement

### ✅ Solutions Recommandées

#### Option 1 : IPFS (Recommandé pour Production)

**Avantages** :
- ✅ Décentralisé et permanent
- ✅ Accessible publiquement
- ✅ Standard pour les NFTs
- ✅ Gratuit (Pinata, NFT.storage)

**Implémentation** :

```typescript
// Exemple avec NFT.storage
import { NFTStorage, File } from 'nft.storage';

async uploadToIPFS(imageBuffer: Buffer, metadata: any): Promise<string> {
  const client = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });
  
  const imageFile = new File([imageBuffer], 'nft.png', { type: 'image/png' });
  const metadataFile = new File([JSON.stringify(metadata)], 'metadata.json', { type: 'application/json' });
  
  const cid = await client.storeDirectory([imageFile, metadataFile]);
  return `ipfs://${cid}/nft.png`;
}
```

**Configuration** :
```env
# Ajouter dans .env
NFT_STORAGE_API_KEY=your_nft_storage_api_key
# Ou
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
```

#### Option 2 : Hedera File Service (HFS)

**Avantages** :
- ✅ Intégré à Hedera
- ✅ Accessible via HashScan
- ✅ Pas de service externe nécessaire

**Inconvénients** :
- ⚠️ Limite de taille (~1-2 MB)
- ⚠️ Peut être instable sur Testnet
- ⚠️ Coûte des HBAR

**Améliorations actuelles** :
- ✅ Retry automatique (3 tentatives)
- ✅ Timeout dynamique selon la taille du fichier
- ✅ Backoff exponentiel entre les tentatives

#### Option 3 : CDN Public (Cloudflare, AWS S3, etc.)

**Avantages** :
- ✅ Rapide et fiable
- ✅ Scalable
- ✅ Contrôle total

**Configuration** :
```env
CDN_BASE_URL=https://cdn.castmate.com
AWS_S3_BUCKET=castmate-nft-images
CLOUDFLARE_R2_BUCKET=castmate-nft-images
```

---

## 📊 3. Métadonnées NFT

### ✅ Limite de 100 Bytes (Respectée)

Le système utilise actuellement :
```json
{"image": "https://i.postimg.cc/zvF4Z1jj/1.jpg"}
```
- Taille : 47 bytes ✅
- Sous la limite de 100 bytes

### 🔄 Métadonnées Complètes

Les métadonnées complètes sont uploadées sur Hedera File Service :
- Format HIP-412 (Token Metadata JSON Schema V2)
- Accessible via `https://hashscan.io/testnet/file/0.0.xxxxx`

### 💡 Recommandations

1. **Si vous voulez inclure plus d'infos dans le NFT** :
   - Utiliser une référence IPFS : `{"ipfs": "QmXXXXX"}`
   - Ou référence HFS : `{"m": "0.0.xxxxx"}`

2. **Standardiser les métadonnées** :
   - Toujours utiliser le format HIP-412
   - Inclure les attributs requis (name, type, image)
   - Ajouter les attributs optionnels (description, attributes, etc.)

---

## 🔄 4. Gestion d'Erreurs HFS

### ✅ Améliorations Actuelles

1. **Retry avec backoff exponentiel** :
   - Tentative 1 : Immédiate
   - Tentative 2 : Attente 2s
   - Tentative 3 : Attente 4s
   - Maximum : 30s entre tentatives

2. **Timeout dynamique** :
   - Base : 10 secondes
   - +1 seconde par 10 KB de fichier
   - Maximum : 60 secondes

3. **Frais dynamiques** :
   - Minimum : 20 Hbar
   - +1 Hbar par 100 KB

### 💡 Recommandations Supplémentaires

1. **Upload parallèle** (pour gros fichiers) :
   ```typescript
   // Diviser le fichier en chunks et uploader en parallèle
   const chunks = splitFileIntoChunks(imageBuffer, 500 * 1024); // 500 KB par chunk
   const uploadPromises = chunks.map(chunk => uploadChunk(chunk));
   await Promise.all(uploadPromises);
   ```

2. **Queue système** (pour production) :
   - Utiliser Bull/BullMQ pour gérer les uploads
   - Retry automatique en cas d'échec
   - Monitoring des uploads

3. **Fallback automatique** :
   - Si HFS échoue → IPFS
   - Si IPFS échoue → CDN
   - Si tout échoue → Log l'erreur et notifier l'admin

---

## 🌐 5. URLs Publiques

### ⚠️ Problème Actuel

Les URLs `http://localhost:3000` ne sont pas accessibles publiquement.

### ✅ Solution Actuelle

Utilisation d'URLs PostImg pour les images :
- ✅ Accessible publiquement
- ✅ Fonctionne pour Testnet
- ⚠️ Dépend d'un service externe

### 🔄 Recommandations Production

1. **Héberger les images publiquement** :
   - IPFS (recommandé)
   - CDN (Cloudflare, AWS CloudFront)
   - Hedera File Service (si stable)

2. **Configuration** :
   ```env
   # Production
   NFT_IMAGE_BASE_URL=https://ipfs.io/ipfs
   # Ou
   NFT_IMAGE_BASE_URL=https://cdn.castmate.com/nft-images
   ```

3. **Migration** :
   - Uploader toutes les images existantes sur IPFS/CDN
   - Mettre à jour les URLs dans la base de données
   - Mettre à jour `metadata.json` avec les nouvelles URLs

---

## 📈 6. Monitoring et Observabilité

### Recommandations

1. **Logging** :
   - ✅ Logs détaillés pour chaque étape
   - ✅ Logs d'erreur avec stack traces
   - 💡 Ajouter des métriques (temps d'upload, taux de succès, etc.)

2. **Alertes** :
   - Alerter si le taux d'échec HFS > 50%
   - Alerter si le solde HBAR < seuil minimum
   - Alerter si les uploads prennent trop de temps

3. **Dashboard** :
   - Nombre de NFTs créés
   - Taux de succès des uploads
   - Coûts HBAR par NFT
   - Temps moyen de création

---

## 💰 7. Gestion des Coûts

### Coûts Hedera (Mainnet)

- **Création de série NFT** : ~1-2 HBAR (une seule fois)
- **Mint NFT** : ~0.01 HBAR par NFT
- **Upload HFS** : ~0.1-0.5 HBAR par fichier (selon taille)
- **Transfert NFT** : ~0.01 HBAR par transfert

### Recommandations

1. **Budget** :
   - Estimer le nombre de NFTs par mois
   - Prévoir un budget HBAR mensuel
   - Surveiller les dépenses régulièrement

2. **Optimisation** :
   - Réutiliser la série NFT (déjà fait ✅)
   - Utiliser IPFS pour les images (gratuit)
   - Batch les transactions si possible

---

## ✅ Checklist Production

### Avant le Déploiement

- [ ] `.env` est dans `.gitignore` ✅
- [ ] Clés privées dans un gestionnaire de secrets
- [ ] Compte Hedera Mainnet créé et configuré
- [ ] Budget HBAR alloué
- [ ] Images hébergées publiquement (IPFS/CDN)
- [ ] Métadonnées au format HIP-412
- [ ] Tests sur Testnet réussis
- [ ] Monitoring configuré
- [ ] Alertes configurées
- [ ] Documentation à jour

### Configuration Production

```env
# Network
HEDERA_NETWORK=mainnet
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=0x...  # Depuis gestionnaire de secrets
HEDERA_TOKEN_ID=0.0.xxxxx  # Série NFT existante

# Image Storage
NFT_STORAGE_TYPE=ipfs  # ou 'hfs', 'cdn'
NFT_STORAGE_API_KEY=...  # Si IPFS
CDN_BASE_URL=https://cdn.castmate.com  # Si CDN

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
```

---

## 📚 Ressources

- [Hedera Documentation](https://docs.hedera.com/)
- [HIP-412 Token Metadata](https://github.com/hashgraph/hedera-improvement-proposal/blob/main/HIP/hip-412.md)
- [NFT.storage](https://nft.storage/)
- [Pinata IPFS](https://www.pinata.cloud/)
- [HashScan Explorer](https://hashscan.io/)

---

## 🔄 Prochaines Étapes

1. **Court terme** :
   - ✅ Améliorer la gestion d'erreurs HFS (fait)
   - ✅ Vérifier la sécurité des clés (fait)
   - 💡 Implémenter le support IPFS

2. **Moyen terme** :
   - 💡 Migrer les images vers IPFS
   - 💡 Ajouter un système de queue pour les uploads
   - 💡 Implémenter le monitoring

3. **Long terme** :
   - 💡 Support multi-storage (IPFS + HFS + CDN)
   - 💡 Fallback automatique entre services
   - 💡 Dashboard de monitoring

---

**Date de création** : 2025-12-06  
**Dernière mise à jour** : 2025-12-06  
**Version** : 1.0

