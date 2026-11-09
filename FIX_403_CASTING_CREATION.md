# 🔧 Fix : Erreur 403 Forbidden lors de la création de casting

## 📋 Problème identifié

L'endpoint `POST /castings` retournait une erreur **403 Forbidden** même lorsque l'utilisateur avait les droits requis (`role=RECRUTEUR` et `type=AGENCE` dans le token JWT).

### Symptômes
- Token JWT valide avec `role=RECRUTEUR` et `type=AGENCE`
- Header `Authorization` correctement envoyé
- Erreur 403 générique sans message explicite
- Aucun log permettant de diagnostiquer le problème

## ✅ Corrections apportées

### 1. Amélioration du `RolesGuard` (`src/common/guards/roles.guard.ts`)

#### Changements :
- ✅ Ajout de logs détaillés pour chaque étape de vérification
- ✅ Vérification explicite de l'existence de l'utilisateur
- ✅ Vérification explicite de l'existence du rôle
- ✅ Comparaison insensible à la casse des rôles (plus robuste)
- ✅ Exception `ForbiddenException` avec message explicite au lieu de retourner simplement `false`
- ✅ Logs d'erreur détaillés pour faciliter le débogage

#### Avant :
```typescript
canActivate(context: ExecutionContext): boolean {
  const { user } = context.switchToHttp().getRequest();
  return requiredRoles.some((role) => user?.role === role);
}
```

#### Après :
```typescript
canActivate(context: ExecutionContext): boolean {
  // Logs détaillés
  // Vérifications explicites
  // Exceptions avec messages clairs
  // Comparaison insensible à la casse
}
```

### 2. Amélioration du `JwtAuthGuard` (`src/common/guards/jwt-auth.guard.ts`)

#### Changements :
- ✅ Logs plus détaillés incluant le Content-Type (pour détecter les problèmes avec multipart)
- ✅ Logs de l'objet utilisateur complet pour débogage
- ✅ S'assurer explicitement que l'utilisateur est attaché à la requête

## 🔍 Logs ajoutés

### Dans `RolesGuard` :
```typescript
[RolesGuard] Vérification des rôles: {
  url: '/castings',
  method: 'POST',
  requiredRoles: ['RECRUTEUR', 'ADMIN'],
  userRole: 'RECRUTEUR',
  userType: 'AGENCE',
  userId: '...',
  hasUser: true,
  userObject: { ... }
}
```

### En cas d'erreur :
```typescript
[RolesGuard] ERREUR: Rôle insuffisant: {
  requiredRoles: ['RECRUTEUR', 'ADMIN'],
  userRole: '...',
  userType: '...',
  userId: '...',
  url: '/castings',
  method: 'POST'
}
```

### Dans `JwtAuthGuard` :
```typescript
[JWT Guard] Authentification réussie: {
  url: '/castings',
  method: 'POST',
  contentType: 'multipart/form-data',
  userId: '...',
  userRole: 'RECRUTEUR',
  userType: 'AGENCE',
  userObject: { ... }
}
```

## 🧪 Tests à effectuer

### 1. Test avec un recruteur valide
```bash
POST /castings
Authorization: Bearer <token_recruteur>
Content-Type: multipart/form-data

payload: {...}
affiche: <fichier>
```

**Résultat attendu** : ✅ 201 Created

### 2. Test avec un acteur (ne devrait pas fonctionner)
```bash
POST /castings
Authorization: Bearer <token_acteur>
```

**Résultat attendu** : ❌ 403 Forbidden avec message explicite

### 3. Test sans token
```bash
POST /castings
```

**Résultat attendu** : ❌ 401 Unauthorized

## 📊 Messages d'erreur améliorés

### Avant :
```
403 Forbidden
```

### Après :
```
403 Forbidden
"Accès refusé. Rôles requis: RECRUTEUR ou ADMIN. Votre rôle: ACTEUR"
```

Ou :
```
403 Forbidden
"Utilisateur non authentifié. Veuillez vous connecter."
```

Ou :
```
403 Forbidden
"Rôle non défini pour l'utilisateur. Rôles requis: RECRUTEUR ou ADMIN"
```

## 🔍 Diagnostic

Si le problème persiste, vérifier les logs backend pour :

1. **Vérifier que l'utilisateur est bien extrait du token** :
   ```
   [JWT Guard] Authentification réussie: { userRole: 'RECRUTEUR', ... }
   ```

2. **Vérifier que le RolesGuard reçoit bien l'utilisateur** :
   ```
   [RolesGuard] Vérification des rôles: { hasUser: true, userRole: 'RECRUTEUR', ... }
   ```

3. **Vérifier la comparaison des rôles** :
   ```
   [RolesGuard] Comparaison rôle: { userRole: 'RECRUTEUR', requiredRole: 'RECRUTEUR', matches: true }
   ```

## 🚨 Points d'attention

1. **Ordre des guards** : L'ordre `@UseGuards(JwtAuthGuard, RolesGuard)` est important
   - `JwtAuthGuard` doit s'exécuter en premier pour attacher l'utilisateur à la requête
   - `RolesGuard` s'exécute ensuite et vérifie le rôle

2. **Requêtes multipart** : Les requêtes `multipart/form-data` peuvent parfois avoir des problèmes avec les headers
   - Les logs incluent maintenant le `Content-Type` pour détecter ces problèmes
   - L'utilisateur est explicitement attaché à la requête dans `JwtAuthGuard`

3. **Comparaison des rôles** : La comparaison est maintenant insensible à la casse
   - `'RECRUTEUR'` === `'recruteur'` === `'Recruteur'`
   - Plus robuste face aux variations de casse dans la base de données

## 📝 Checklist de vérification

- [x] Logs détaillés ajoutés dans `RolesGuard`
- [x] Logs détaillés ajoutés dans `JwtAuthGuard`
- [x] Exceptions explicites avec messages clairs
- [x] Vérification de l'existence de l'utilisateur
- [x] Vérification de l'existence du rôle
- [x] Comparaison insensible à la casse
- [x] S'assurer que l'utilisateur est attaché à la requête

## 🎯 Résultat attendu

Après ces corrections :
- ✅ Les recruteurs peuvent créer des castings
- ✅ Les erreurs 403 ont des messages explicites
- ✅ Les logs permettent de diagnostiquer rapidement les problèmes
- ✅ La comparaison des rôles est plus robuste

## 📞 Support

Si le problème persiste après ces corrections :
1. Vérifier les logs backend pour voir exactement où ça bloque
2. Vérifier que le token JWT contient bien `type: 'AGENCE'` et `role: 'RECRUTEUR'`
3. Vérifier que l'agence existe bien en base de données avec le bon rôle
4. Vérifier que le `JWT_SECRET` est le même côté backend et lors de la création du token

