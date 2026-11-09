# 🔐 Configuration Hedera - Exemple avec vos Credentials

## 📋 Vos Informations de Compte Testnet

D'après votre capture d'écran :

- **Account ID** : `0.0.1234567`
- **EVM Address** : `0x1234567890abcdef1234567890abcdef12345678`
- **HEX Encoded Private Key** : `0x0000000000000000000000000000000000000000000000000000000000000000` (tronqué)

## ⚙️ Configuration dans `.env`

Ajoutez ces lignes dans votre fichier `.env` à la racine du projet :

```env
# Hedera Network Configuration (Testnet)
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.1234567
HEDERA_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
```

## ⚠️ IMPORTANT : Format de la Clé Privée

**Vous devez copier la clé privée COMPLÈTE** (pas tronquée) :

1. Sur Hedera Portal, cliquez sur l'icône **copier** (📋) à côté de "HEX Encoded Private Key"
2. Copiez la clé complète (elle devrait faire environ 66 caractères avec le préfixe `0x`)
3. Collez-la dans votre `.env` après `HEDERA_PRIVATE_KEY=`

**Exemple complet** :
```env
HEDERA_PRIVATE_KEY=0xaf57796cb558762a986dd13fb8726c674948717473abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

## 🔄 Conversion du Format (si nécessaire)

Le Hedera SDK peut accepter la clé en format HEX (avec `0x`). Si vous rencontrez des erreurs, vous pouvez :

### Option 1 : Utiliser directement le format HEX (recommandé)
```env
HEDERA_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
```

### Option 2 : Retirer le préfixe 0x
Si le SDK ne l'accepte pas, retirez le `0x` :
```env
HEDERA_PRIVATE_KEY=af57796cb558762a986dd13fb8726c674948717473...
```

## 📝 Exemple de `.env` Complet

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/casting-app

# JWT Secret
JWT_SECRET=your-secret-key-change-in-production-use-a-strong-random-string

# Port du serveur
PORT=3000

# Hedera Network Configuration (Testnet)
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.1234567
HEDERA_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000  # ⚠️ Remplacez par votre clé COMPLÈTE

# HEDERA_TOKEN_ID sera créé automatiquement lors de la première création de NFT
# Vous pourrez l'ajouter ensuite pour éviter de recréer la série
# HEDERA_TOKEN_ID=0.0.1234567

# URLs (optionnel)
API_BASE_URL=http://localhost:3000
NFT_IMAGE_BASE_URL=http://localhost:3000
```

## ✅ Vérification

Après avoir configuré votre `.env` :

1. **Redémarrez votre serveur** :
   ```bash
   npm run start:dev
   ```

2. **Vérifiez les logs** : Vous devriez voir :
   ```
   [HederaService] Hedera client initialized for testnet
   ```

3. **Testez la création d'un NFT** : Soumettez une session d'entraînement avec score >= 70

## 🔒 Sécurité

**⚠️ RÈGLES D'OR** :

1. ✅ **Ne commitez JAMAIS** votre fichier `.env` dans Git
2. ✅ Vérifiez que `.env` est dans `.gitignore`
3. ✅ Ne partagez jamais votre clé privée
4. ✅ Utilisez Testnet pour le développement (gratuit)
5. ✅ En production, utilisez Mainnet avec un compte dédié

## 🐛 Dépannage

### Erreur : "Invalid private key format"
- Vérifiez que vous avez copié la clé complète (pas tronquée)
- Essayez de retirer le préfixe `0x` si présent
- Vérifiez qu'il n'y a pas d'espaces avant/après la clé

### Erreur : "Insufficient balance"
- Votre compte n'a pas assez de HBAR
- Allez sur Hedera Portal → "Get Testnet HBAR" → Utilisez le faucet
- Vous avez besoin d'environ 1-2 HBAR pour créer une série NFT

### Erreur : "Hedera is not configured"
- Vérifiez que les variables sont bien dans `.env` (pas de commentaires `#` devant)
- Redémarrez le serveur après modification du `.env`

## 📚 Prochaines Étapes

1. ✅ Configurez votre `.env` avec vos credentials
2. ✅ Redémarrez le serveur
3. ✅ Testez avec une session d'entraînement (score >= 70)
4. ✅ Le système créera automatiquement la série NFT
5. ✅ Notez le `HEDERA_TOKEN_ID` généré et ajoutez-le dans `.env`

Bonne configuration ! 🚀

