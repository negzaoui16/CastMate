# 📦 Utilisation du CID IPFS pour les NFTs

## 🎯 Vue d'ensemble

Le système supporte maintenant l'utilisation d'un CID IPFS dans les métadonnées du NFT, comme recommandé par Hedera.

---

## 🔧 Configuration

### Option 1 : CID IPFS dans metadata.json

Ajoutez le CID IPFS dans votre fichier `public/nft-metadata/metadata.json` :

```json
{
  "name": "CastMate Training Card - Niveau 1",
  "description": "NFT pour la réussite du niveau 1",
  "image": "ipfs://bafkreidojnia4hydskvmzlarbmvfadsujjpmhswprhuns4l6xm4mynjjwa",
  "type": "image/png",
  "format": "HIP412@2.0.0",
  "ipfsCid": "bafkreigzni7xkagdp3lubu3vgbdxiouqscs3qjupfatq5i2swiciar7csa"
}
```

Le système extraira automatiquement le CID depuis :
1. Le champ `ipfsCid` ou `cid` dans metadata.json
2. L'URL IPFS dans le champ `image` (format: `ipfs://CID/...`)
3. La variable d'environnement `NFT_IPFS_CID`

### Option 2 : Variable d'environnement

Ajoutez dans votre `.env` :

```env
NFT_IPFS_CID=bafkreigzni7xkagdp3lubu3vgbdxiouqscs3qjupfatq5i2swiciar7csa
```

---

## 📝 Format des Métadonnées NFT

Le système construit automatiquement l'URL IPFS vers `metadata.json` :

```
ipfs://bafkreigzni7xkagdp3lubu3vgbdxiouqscs3qjupfatq5i2swiciar7csa/metadata.json
```

Cette URL est convertie en Buffer et utilisée dans les métadonnées du NFT :

```typescript
const CID = [
  Buffer.from("ipfs://bafkreigzni7xkagdp3lubu3vgbdxiouqscs3qjupfatq5i2swiciar7csa/metadata.json")
];

const mintTx = await new TokenMintTransaction()
  .setTokenId(tokenId)
  .setMetadata(CID)
  .freezeWith(client);
```

---

## 🔄 Priorité de Sélection

Le système utilise les métadonnées dans cet ordre de priorité :

1. **CID IPFS depuis variable d'environnement** (`NFT_IPFS_CID`)
2. **CID IPFS depuis metadata.json** (`ipfsCid` ou `cid`)
3. **CID extrait depuis l'URL IPFS** dans `metadata.json.image` (format: `ipfs://CID/...`)
4. **URL de l'image** (PostImg, etc.) si pas de CID IPFS
5. **Métadonnées minimales** (fallback)

---

## ✅ Vérification de la Taille

Le système vérifie automatiquement que l'URL IPFS fait moins de 100 bytes (limite Hedera) :

- ✅ `ipfs://bafkreigzni7xkagdp3lubu3vgbdxiouqscs3qjupfatq5i2swiciar7csa/metadata.json` = ~85 bytes
- Si trop long → Fallback vers l'URL de l'image

---

## 📊 Exemple Complet

### 1. Préparer metadata.json sur IPFS

Votre fichier `metadata.json` doit être uploadé sur IPFS et accessible via :

```
ipfs://bafkreigzni7xkagdp3lubu3vgbdxiouqscs3qjupfatq5i2swiciar7csa/metadata.json
```

### 2. Configurer le CID

**Option A** : Dans `metadata.json` :
```json
{
  "ipfsCid": "bafkreigzni7xkagdp3lubu3vgbdxiouqscs3qjupfatq5i2swiciar7csa"
}
```

**Option B** : Dans `.env` :
```env
NFT_IPFS_CID=bafkreigzni7xkagdp3lubu3vgbdxiouqscs3qjupfatq5i2swiciar7csa
```

### 3. Créer le NFT

Lors de la création d'un NFT, le système :
1. Détecte le CID IPFS
2. Construit l'URL : `ipfs://{CID}/metadata.json`
3. Convertit en Buffer
4. Mint le NFT avec ce Buffer dans les métadonnées

---

## 🔍 Logs

Vous verrez dans les logs :

```
✅ Using IPFS CID in NFT metadata (85 bytes): ipfs://bafkreigzni7xkagdp3lubu3vgbdxiouqscs3qjupfatq5i2swiciar7csa/metadata.json
Minting NFT with IPFS CID: ipfs://bafkreigzni7xkagdp3lubu3vgbdxiouqscs3qjupfatq5i2swiciar7csa/metadata.json
NFT minted with Serial Number: 1, Transaction: 0.0.xxxxx@...
```

---

## 🚀 Avantages

- ✅ **Standard IPFS** : Compatible avec tous les wallets et explorateurs
- ✅ **Décentralisé** : Les métadonnées sont stockées sur IPFS
- ✅ **Permanent** : Les métadonnées ne peuvent pas être modifiées
- ✅ **Accessible** : Accessible via n'importe quel gateway IPFS

---

## 📚 Ressources

- [Hedera NFT Metadata](https://docs.hedera.com/hedera/sdks-and-apis/sdks/nft/metadata)
- [IPFS Documentation](https://docs.ipfs.io/)
- [HIP-412 Token Metadata](https://github.com/hashgraph/hedera-improvement-proposal/blob/main/HIP/hip-412.md)

---

**Date de création** : 2025-12-06  
**Version** : 1.0

