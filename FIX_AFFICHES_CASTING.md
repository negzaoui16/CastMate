# 🖼️ Fix : Affichage des Affiches de Casting

## 📋 Problème Identifié

Les affiches (photos) des castings ne s'affichaient pas côté frontend car le backend ne retournait que l'ID du fichier (`afficheFileId`) sans l'URL complète.

## ✅ Changements Backend (DÉJÀ FAIT)

### 1. Ajout de ConfigService dans CastingsModule
```typescript
// src/castings/castings.module.ts
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    // ...
    ConfigModule, // ✅ Ajouté
  ],
})
```

### 2. Transformation automatique des castings
Le service ajoute maintenant automatiquement l'URL complète de l'affiche dans tous les endpoints qui retournent des castings :

```typescript
// Le backend transforme maintenant automatiquement :
{
  media: {
    afficheFileId: "507f1f77bcf86cd799439011"
  }
}

// En :
{
  media: {
    afficheFileId: "507f1f77bcf86cd799439011",
    afficheUrl: "http://localhost:3000/media/507f1f77bcf86cd799439011" // ✅ NOUVEAU
  }
}
```

## 🔧 Changements Frontend (À FAIRE)

### Structure de la réponse API

Tous les endpoints qui retournent des castings incluent maintenant `media.afficheUrl` :

- `GET /castings` (liste)
- `GET /castings/:id` (détails)
- `POST /castings` (création)
- `PATCH /castings/:id` (mise à jour)
- `POST /castings/:id/apply` (candidature)
- `PATCH /castings/:id/candidates/:acteurId/accept`
- `PATCH /castings/:id/candidates/:acteurId/reject`
- `POST /castings/:id/candidates/:acteurId/accept-with-interview`

### Exemple de réponse complète

```typescript
interface CastingResponse {
  _id: string;
  titre: string;
  descriptionRole: string;
  synopsis: string;
  lieu: string;
  dateDebut: string;
  dateFin: string;
  prix: number;
  types: string[];
  age?: string;
  conditions: string;
  ouvert: boolean;
  recruteur: {
    _id: string;
    nomAgence: string;
    // ...
  };
  candidats: Array<{
    acteurId: {
      _id: string;
      nom: string;
      prenom: string;
      // ...
    };
    statut: 'EN_ATTENTE' | 'ACCEPTE' | 'REFUSE';
    dateCandidature: string;
    // ...
  }>;
  media?: {
    afficheFileId: string;        // ID du fichier (pour référence)
    afficheMimeType?: string;      // Type MIME (ex: "image/jpeg")
    afficheOriginalName?: string;  // Nom original du fichier
    afficheLength?: number;        // Taille en bytes
    afficheUploadDate?: string;    // Date d'upload
    afficheUrl: string;            // ✅ NOUVEAU : URL complète de l'image
  };
  createdAt: string;
  updatedAt: string;
}
```

### Code Frontend à Modifier

#### ❌ AVANT (ne fonctionnait pas)

```typescript
// ❌ Ancien code qui ne fonctionnait pas
const casting = await fetch(`/api/castings/${id}`).then(r => r.json());

// Tentative d'utiliser directement le fileId (ne fonctionne pas)
const imageUrl = casting.media?.afficheFileId 
  ? `/media/${casting.media.afficheFileId}` 
  : null;

<img src={imageUrl} alt={casting.titre} />
```

#### ✅ APRÈS (fonctionne maintenant)

```typescript
// ✅ Nouveau code qui fonctionne
const casting = await fetch(`/api/castings/${id}`).then(r => r.json());

// Utiliser directement afficheUrl fournie par le backend
const imageUrl = casting.media?.afficheUrl || null;

<img src={imageUrl} alt={casting.titre} />
```

### Exemples par Framework

#### React / React Native

```tsx
// Composant React
function CastingCard({ casting }) {
  const imageUrl = casting.media?.afficheUrl;
  
  return (
    <div className="casting-card">
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt={casting.titre}
          onError={(e) => {
            // Fallback si l'image ne charge pas
            e.target.src = '/placeholder-casting.jpg';
          }}
        />
      ) : (
        <div className="no-image">Pas d'affiche</div>
      )}
      <h3>{casting.titre}</h3>
    </div>
  );
}
```

#### Vue.js

```vue
<template>
  <div class="casting-card">
    <img 
      v-if="casting.media?.afficheUrl"
      :src="casting.media.afficheUrl"
      :alt="casting.titre"
      @error="handleImageError"
    />
    <div v-else class="no-image">Pas d'affiche</div>
    <h3>{{ casting.titre }}</h3>
  </div>
</template>

<script>
export default {
  props: {
    casting: Object
  },
  methods: {
    handleImageError(event) {
      event.target.src = '/placeholder-casting.jpg';
    }
  }
}
</script>
```

#### Flutter / Dart

```dart
class CastingCard extends StatelessWidget {
  final Casting casting;
  
  @override
  Widget build(BuildContext context) {
    final imageUrl = casting.media?.afficheUrl;
    
    return Card(
      child: Column(
        children: [
          if (imageUrl != null)
            Image.network(
              imageUrl,
              errorBuilder: (context, error, stackTrace) {
                return Image.asset('assets/placeholder-casting.jpg');
              },
            )
          else
            Container(
              height: 200,
              color: Colors.grey[300],
              child: Center(child: Text('Pas d\'affiche')),
            ),
          Text(casting.titre),
        ],
      ),
    );
  }
}
```

### Gestion des erreurs et fallback

```typescript
// Fonction utilitaire pour obtenir l'URL de l'affiche
function getCastingImageUrl(casting: CastingResponse): string | null {
  // 1. Utiliser afficheUrl si disponible (recommandé)
  if (casting.media?.afficheUrl) {
    return casting.media.afficheUrl;
  }
  
  // 2. Fallback : construire l'URL depuis afficheFileId (si afficheUrl manque)
  if (casting.media?.afficheFileId) {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/media/${casting.media.afficheFileId}`;
  }
  
  // 3. Pas d'image disponible
  return null;
}

// Utilisation
const imageUrl = getCastingImageUrl(casting) || '/default-casting-image.jpg';
```

### Authentification pour les images

⚠️ **Important** : Les affiches de casting nécessitent une authentification JWT pour être accessibles.

```typescript
// Si vous utilisez fetch
const imageUrl = casting.media?.afficheUrl;

// Pour les requêtes d'images, inclure le token dans les headers
fetch(imageUrl, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Ou utiliser des cookies si configuré
// Les navigateurs incluront automatiquement les cookies
```

### Configuration de la base URL

Le backend utilise la variable d'environnement `API_BASE_URL` pour construire les URLs. Par défaut, c'est `http://localhost:3000`.

**En production**, assurez-vous que :
1. La variable `API_BASE_URL` est définie dans `.env`
2. Elle pointe vers l'URL publique de votre API (ex: `https://api.votredomaine.com`)

```env
# .env
API_BASE_URL=https://api.votredomaine.com
```

## 📝 Checklist Frontend

- [ ] Remplacer toutes les utilisations de `afficheFileId` par `afficheUrl`
- [ ] Ajouter une gestion d'erreur pour les images qui ne chargent pas
- [ ] Ajouter un placeholder pour les castings sans affiche
- [ ] Vérifier que les requêtes d'images incluent le token d'authentification si nécessaire
- [ ] Tester avec des castings avec et sans affiche
- [ ] Tester sur différents environnements (dev, staging, production)

## 🧪 Test

Pour tester que tout fonctionne :

1. **Créer un casting avec une affiche** :
   ```bash
   POST /castings
   Content-Type: multipart/form-data
   - payload: {...}
   - affiche: [fichier image]
   ```

2. **Récupérer le casting** :
   ```bash
   GET /castings/:id
   ```

3. **Vérifier la réponse** :
   ```json
   {
     "media": {
       "afficheFileId": "507f1f77bcf86cd799439011",
       "afficheUrl": "http://localhost:3000/media/507f1f77bcf86cd799439011"
     }
   }
   ```

4. **Tester l'affichage** :
   - L'image devrait s'afficher en utilisant `media.afficheUrl`
   - Si l'image ne charge pas, vérifier les headers d'authentification

## 🎯 Résumé

**Backend** : ✅ Déjà corrigé - Les URLs sont maintenant automatiquement ajoutées

**Frontend** : ⚠️ À modifier - Utiliser `casting.media.afficheUrl` au lieu de construire l'URL manuellement

---

**Questions ?** Contactez l'équipe backend si vous avez besoin d'aide pour l'intégration.

