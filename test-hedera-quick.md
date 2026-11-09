# ⚡ Test Rapide Hedera - Guide Express

## 🚀 Test en 5 Minutes

### Étape 1 : Démarrer le serveur

```bash
npm run start:dev
```

**Vérifiez les logs** - Vous devriez voir :
```
[HederaService] Hedera client initialized for testnet
```

### Étape 2 : Obtenir un Token JWT

**Option A : Via Swagger** (Le plus simple)
1. Ouvrez : `http://localhost:3000/api`
2. Trouvez `POST /auth/login`
3. Cliquez "Try it out"
4. Entrez les credentials d'un acteur existant :
```json
{
  "email": "votre_email@example.com",
  "password": "votre_mot_de_passe"
}
```
5. Cliquez "Execute"
6. **Copiez le `access_token`** de la réponse

**Option B : Via cURL**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"votre_email@example.com","password":"votre_mot_de_passe"}'
```

### Étape 3 : Créer un NFT (Test)

**Via Swagger** :
1. Trouvez `POST /training/submit`
2. Cliquez "Authorize" (🔒) et entrez : `Bearer VOTRE_TOKEN`
3. Cliquez "Try it out"
4. Utilisez ce body (remplacez `VOTRE_ACTEUR_ID` par un ID réel) :

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

5. Cliquez "Execute"

**Réponse attendue** :
```json
{
  "session": {
    "id": "...",
    "niveau": 1,
    "globalScore": 85,
    "nftRewarded": true
  },
  "nftReward": {
    "tokenId": "0.0.1234567",
    "serialNumber": "1",
    "transactionId": "0.0.1234567@1234567890.123456789",
    "status": "MINTED"
  }
}
```

### Étape 4 : Vérifier sur HashScan

1. **Copiez le `transactionId`** de la réponse
2. Allez sur : https://hashscan.io/testnet
3. **Collez le `transactionId`** dans la barre de recherche
4. Vérifiez que le status est **SUCCESS**

## ✅ Test Réussi !

Si vous voyez :
- ✅ `nftReward` dans la réponse
- ✅ `status: "MINTED"`
- ✅ Transaction visible sur HashScan

**Hedera fonctionne parfaitement !** 🎉

## 🐛 Si ça ne marche pas

### Erreur : "Hedera is not configured"
→ Vérifiez votre `.env` et redémarrez le serveur

### Erreur : "Insufficient balance"
→ Allez sur [Hedera Portal](https://portal.hedera.com/) → Get Testnet HBAR

### Pas de `nftReward` dans la réponse
→ Vérifiez que `globalScore >= 70`

### Erreur 401 Unauthorized
→ Vérifiez que votre token JWT est valide et bien formaté : `Bearer VOTRE_TOKEN`

## 📝 Exemple Complet avec cURL

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"votre_email@example.com","password":"votre_mot_de_passe"}' \
  | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

# 2. Soumettre un entraînement
curl -X POST http://localhost:3000/training/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
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

