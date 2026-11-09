# 🧪 Guide de Test Hedera Network

## ✅ Étape 1 : Vérifier la Configuration

### 1.1 Vérifier votre `.env`

Assurez-vous que votre `.env` contient :

```env
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.7359554
HEDERA_PRIVATE_KEY=0xaf57796cb558762a986dd13fb8726c674948717473...  # Votre clé complète
```

### 1.2 Démarrer le serveur

```bash
npm run start:dev
```

### 1.3 Vérifier les logs au démarrage

Vous devriez voir dans la console :

```
[HederaService] Hedera client initialized for testnet
```

**Si vous voyez** :
```
[HederaService] Hedera credentials not configured...
```
→ Vérifiez que vos variables sont bien dans `.env` et redémarrez le serveur.

**Si vous voyez une erreur** :
```
[HederaService] Error initializing Hedera client: ...
```
→ Vérifiez le format de votre clé privée (elle doit être complète).

## 🎯 Étape 2 : Tester via l'API

### Option A : Via Swagger UI (Recommandé)

1. **Ouvrez Swagger** : `http://localhost:3000/api`

2. **Connectez-vous** :
   - Cliquez sur le bouton **"Authorize"** (🔒) en haut à droite
   - Entrez votre token JWT : `Bearer <votre_token>`
   - Cliquez sur **"Authorize"**

3. **Testez l'endpoint Training** :
   - Trouvez `POST /training/submit`
   - Cliquez sur **"Try it out"**
   - Remplissez le body avec :

```json
{
  "acteurId": "VOTRE_ACTEUR_ID",
  "niveau": 1,
  "globalScore": 85,
  "emotions": {
    "detected": ["joie", "enthousiasme"],
    "coherence": 90,
    "intensity": 85
  },
  "strengths": [
    "Excellent contact visuel",
    "Émotions authentiques"
  ],
  "recommendations": [
    "Amplifier les émotions"
  ]
}
```

4. **Cliquez sur "Execute"**

5. **Vérifiez la réponse** :
   - Si `globalScore >= 70`, vous devriez recevoir un `nftReward` avec :
     - `tokenId` : ID du token NFT (ex: `0.0.1234567`)
     - `serialNumber` : Numéro de série du NFT
     - `transactionId` : ID de la transaction Hedera
     - `status`: `"MINTED"`

### Option B : Via cURL

```bash
curl -X POST http://localhost:3000/training/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_TOKEN_JWT" \
  -d '{
    "acteurId": "VOTRE_ACTEUR_ID",
    "niveau": 1,
    "globalScore": 85,
    "emotions": {
      "detected": ["joie", "enthousiasme"],
      "coherence": 90,
      "intensity": 85
    },
    "strengths": ["Excellent contact visuel"],
    "recommendations": ["Amplifier les émotions"]
  }'
```

### Option C : Via Postman/Insomnia

1. Créez une requête `POST` vers `http://localhost:3000/training/submit`
2. Headers :
   - `Content-Type: application/json`
   - `Authorization: Bearer <votre_token>`
3. Body (JSON) : Utilisez le même JSON que ci-dessus

## 🔍 Étape 3 : Vérifier sur HashScan

### 3.1 Vérifier la Transaction

1. **Copiez le `transactionId`** de la réponse API
2. **Allez sur** [HashScan Testnet](https://hashscan.io/testnet)
3. **Collez le `transactionId`** dans la barre de recherche
4. **Vérifiez** :
   - ✅ Status : `SUCCESS`
   - ✅ Type : `TOKENMINT`
   - ✅ Token ID : Votre token NFT

### 3.2 Vérifier votre Compte

1. **Allez sur** [HashScan Testnet](https://hashscan.io/testnet)
2. **Recherchez votre Account ID** : `0.0.7359554`
3. **Vérifiez** :
   - ✅ Votre balance HBAR
   - ✅ Les NFTs que vous possédez (onglet "NFTs")

### 3.3 Vérifier le Token NFT

1. **Copiez le `tokenId`** de la réponse API
2. **Allez sur** [HashScan Testnet](https://hashscan.io/testnet)
3. **Recherchez le Token ID**
4. **Vérifiez** :
   - ✅ Type : `NON_FUNGIBLE_UNIQUE`
   - ✅ Nom : `CastMate Training NFT`
   - ✅ Symbol : `CMT`
   - ✅ Supply : Nombre de NFTs créés

## 📊 Étape 4 : Vérifier dans l'API

### 4.1 Récupérer les NFTs d'un acteur

```bash
GET http://localhost:3000/training/actor/VOTRE_ACTEUR_ID/nfts
```

**Réponse attendue** :
```json
[
  {
    "id": "...",
    "acteurId": "...",
    "niveau": 1,
    "score": 85,
    "tokenId": "0.0.1234567",
    "serialNumber": "1",
    "transactionId": "0.0.1234567@1234567890.123456789",
    "imageUrl": "http://localhost:3000/training/nft-images/1.png",
    "status": "MINTED",
    "mintedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

### 4.2 Vérifier l'image NFT

Ouvrez dans votre navigateur :
```
http://localhost:3000/training/nft-images/1.png
```

Vous devriez voir l'image de la carte NFT pour le niveau 1.

## 🐛 Dépannage

### Problème : "Hedera is not configured"

**Solutions** :
1. Vérifiez que `.env` contient bien les variables
2. Redémarrez le serveur après modification de `.env`
3. Vérifiez qu'il n'y a pas d'espaces avant/après les valeurs

### Problème : "Insufficient balance"

**Solution** :
1. Allez sur [Hedera Portal](https://portal.hedera.com/)
2. Connectez-vous avec votre compte `0.0.7359554`
3. Allez dans "Get Testnet HBAR"
4. Utilisez le faucet pour obtenir des HBAR gratuits
5. Vous avez besoin d'environ 1-2 HBAR pour créer une série NFT

### Problème : "Invalid private key format"

**Solutions** :
1. Vérifiez que vous avez copié la clé complète (pas tronquée)
2. La clé doit commencer par `0x` et faire ~66 caractères
3. Essayez de retirer le préfixe `0x` si le SDK ne l'accepte pas

### Problème : "Error minting NFT"

**Vérifications** :
1. Consultez les logs du serveur pour l'erreur exacte
2. Vérifiez votre balance HBAR (minimum 1-2 HBAR)
3. Vérifiez que le compte a les permissions nécessaires
4. Vérifiez que `HEDERA_NETWORK=testnet` est bien configuré

### Problème : NFT créé mais pas visible sur HashScan

**Solutions** :
1. Attendez quelques secondes (la blockchain peut prendre du temps)
2. Vérifiez que vous êtes sur HashScan **Testnet** (pas Mainnet)
3. Utilisez le `transactionId` pour vérifier directement la transaction

## ✅ Checklist de Test

- [ ] Serveur démarre sans erreur
- [ ] Logs montrent "Hedera client initialized for testnet"
- [ ] Soumission d'entraînement avec score >= 70 réussie
- [ ] Réponse contient `nftReward` avec `status: "MINTED"`
- [ ] Transaction visible sur HashScan
- [ ] Token NFT visible sur HashScan
- [ ] Image NFT accessible via `/training/nft-images/1.png`
- [ ] NFTs récupérables via `/training/actor/:id/nfts`

## 🎉 Test Réussi !

Si tous les points de la checklist sont validés, **Hedera est correctement configuré et fonctionne** ! 🚀

Vous pouvez maintenant :
- Créer des NFTs pour chaque niveau
- Les transférer vers HashPack
- Les consulter sur HashScan

## 📚 Ressources

- [HashScan Testnet](https://hashscan.io/testnet) - Explorer la blockchain
- [Hedera Portal](https://portal.hedera.com/) - Gérer votre compte
- [Swagger UI](http://localhost:3000/api) - Tester l'API

