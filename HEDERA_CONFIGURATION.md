# 🔐 Configuration Hedera Network - Guide Complet

## 📋 Qu'est-ce que Hedera Network ?

**Hedera** est une blockchain publique décentralisée qui permet de créer et gérer des NFTs (Non-Fungible Tokens). Contrairement à Ethereum, Hedera utilise un système de consensus différent (Hashgraph) qui est plus rapide, moins cher et plus écologique.

## 🎯 Pourquoi utiliser Hedera pour les NFTs ?

- ✅ **Frais très bas** : ~$0.0001 par transaction (vs ~$50-100 sur Ethereum)
- ✅ **Rapide** : Transactions finalisées en quelques secondes
- ✅ **Écologique** : Consommation d'énergie négligeable
- ✅ **Scalable** : Peut gérer des milliers de transactions par seconde

## 🔧 Configuration Hedera

### Option 1 : Mode Développement (Sans Hedera - Mode Mock)

**Par défaut**, si vous ne configurez pas Hedera, le système fonctionne en **mode mock** :
- Les NFTs sont créés avec des IDs fictifs (`MOCK_TOKEN_ID`, etc.)
- Les sessions d'entraînement sont toujours enregistrées
- Les NFTs mock peuvent être consultés normalement
- **Aucune transaction réelle sur la blockchain**

**Avantages** :
- ✅ Pas besoin de compte Hedera
- ✅ Pas de frais
- ✅ Développement rapide
- ✅ Test complet du système

**Inconvénients** :
- ❌ Les NFTs ne sont pas réels (pas sur la blockchain)
- ❌ Ne peuvent pas être transférés vers HashPack

### Option 2 : Mode Production (Avec Hedera - Testnet)

Pour créer de **vrais NFTs** sur la blockchain Hedera :

#### Étape 1 : Créer un compte Hedera Testnet

1. Allez sur [Hedera Portal](https://portal.hedera.com/)
2. Cliquez sur **"Create Account"**
3. Choisissez **"Testnet"** (gratuit, pour le développement)
4. Téléchargez votre **Account ID** et **Private Key**
5. **⚠️ IMPORTANT** : Sauvegardez votre clé privée en sécurité !

#### Étape 2 : Obtenir des HBAR (gratuit sur testnet)

1. Sur Hedera Portal, allez dans **"Get Testnet HBAR"**
2. Utilisez le faucet pour obtenir des HBAR gratuits
3. Vous avez besoin d'environ 1-2 HBAR pour créer une série NFT

#### Étape 3 : Configurer les variables d'environnement

Ajoutez dans votre fichier `.env` :

```env
# Hedera Network Configuration
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.1234567
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
```

**Format de la clé privée** :
- Commence par `302e020100300506032b657004220420`
- Suivi de 64 caractères hexadécimaux
- Exemple : `302e020100300506032b657004220420a1b2c3d4e5f6...`

#### Étape 4 : Créer la série NFT (automatique)

Lors de la première soumission d'entraînement avec score >= 70 :
1. Le système crée automatiquement une série NFT sur Hedera
2. Un **Token ID** est généré (ex: `0.0.1234567`)
3. **Ajoutez ce Token ID dans votre `.env`** pour le réutiliser :

```env
HEDERA_TOKEN_ID=0.0.1234567
```

**Pourquoi ?** : Évite de créer une nouvelle série à chaque fois.

### Option 3 : Mode Production (Mainnet)

Pour la **production réelle** avec de vrais NFTs :

1. Créez un compte **Mainnet** sur Hedera Portal
2. Achetez des HBAR (nécessaires pour les transactions)
3. Configurez dans `.env` :

```env
HEDERA_NETWORK=mainnet
HEDERA_ACCOUNT_ID=0.0.1234567
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
```

**⚠️ ATTENTION** :
- Les transactions sur mainnet coûtent de l'argent réel
- Utilisez un compte dédié avec un budget limité
- Ne partagez jamais votre clé privée

## 📊 Comparaison des Modes

| Fonctionnalité | Mode Mock | Testnet | Mainnet |
|----------------|-----------|---------|---------|
| NFTs réels | ❌ | ✅ | ✅ |
| Frais | Gratuit | Gratuit | Payant (~$0.0001/tx) |
| Blockchain | Non | Oui (test) | Oui (production) |
| Transfert HashPack | ❌ | ✅ | ✅ |
| Utilisation | Dev | Dev/Test | Production |

## 🔄 Workflow Recommandé

### Phase 1 : Développement (Mode Mock)
```env
# Pas de configuration Hedera nécessaire
# Le système fonctionne en mode mock automatiquement
```

### Phase 2 : Tests (Testnet)
```env
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.1234567
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
```

### Phase 3 : Production (Mainnet)
```env
HEDERA_NETWORK=mainnet
HEDERA_ACCOUNT_ID=0.0.1234567
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
HEDERA_TOKEN_ID=0.0.1234567
```

## 🛠️ Dépannage

### Erreur : "Hedera is not configured"
**Solution** : C'est normal en mode mock. Si vous voulez utiliser Hedera, configurez les variables d'environnement.

### Erreur : "Insufficient balance"
**Solution** : Votre compte Hedera n'a pas assez de HBAR. Utilisez le faucet testnet ou achetez des HBAR.

### Erreur : "Invalid private key format"
**Solution** : Vérifiez que votre clé privée commence par `302e020100300506032b657004220420` et fait 88 caractères au total.

### Les NFTs ne sont pas créés
**Vérifications** :
1. Le score est >= 70 ?
2. Hedera est configuré correctement ?
3. Votre compte a des HBAR ?
4. Consultez les logs pour plus de détails

## 📚 Ressources

- [Hedera Portal](https://portal.hedera.com/) - Créer un compte
- [Hedera Documentation](https://docs.hedera.com/) - Documentation officielle
- [HashPack Wallet](https://www.hashpack.app/) - Wallet pour gérer vos NFTs
- [HashScan](https://hashscan.io/) - Explorer de la blockchain Hedera

## 🔒 Sécurité

**⚠️ RÈGLES D'OR** :

1. **Ne commitez JAMAIS** votre `HEDERA_PRIVATE_KEY` dans Git
2. Utilisez des variables d'environnement (`.env` dans `.gitignore`)
3. En production, utilisez un gestionnaire de secrets (Vercel, AWS Secrets Manager, etc.)
4. Limitez les permissions du compte Hedera utilisé
5. Surveillez les transactions et les dépenses

## 💡 Exemple de Configuration Complète

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/casting-app

# JWT
JWT_SECRET=your-secret-key

# Port
PORT=3000

# Hedera (Optionnel - Mode Mock si non défini)
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.1234567
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890123456
HEDERA_TOKEN_ID=0.0.1234567

# URLs (Optionnel)
API_BASE_URL=http://localhost:3000
NFT_IMAGE_BASE_URL=http://localhost:3000
```

## ❓ Questions Fréquentes

**Q : Dois-je configurer Hedera pour développer ?**
R : Non, le mode mock fonctionne parfaitement pour le développement.

**Q : Combien coûte un NFT sur Hedera ?**
R : Environ $0.0001 par NFT minté (quasi gratuit).

**Q : Puis-je utiliser Ethereum à la place ?**
R : Le code actuel est spécifique à Hedera, mais pourrait être adapté.

**Q : Les NFTs mock peuvent-ils être transférés ?**
R : Non, seuls les vrais NFTs sur Hedera peuvent être transférés vers HashPack.

