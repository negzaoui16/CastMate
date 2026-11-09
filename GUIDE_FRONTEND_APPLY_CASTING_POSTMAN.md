# 📮 Guide Postman - Test de POST /castings/{id}/apply

**Pour l'équipe Frontend Android : Utilisez ce guide pour tester l'API avec Postman et comprendre exactement ce que le backend attend.**

---

## 🎯 Configuration Postman

### 1. Créer une nouvelle requête

1. Ouvrir Postman
2. Cliquer sur "New" → "HTTP Request"
3. Nommer la requête : "Apply to Casting"

### 2. Configurer la requête

**Method** : `POST`

**URL** : 
```
https://cast-mate.vercel.app/castings/693f0a9897caff2222dc87f1/apply
```

---

## 🔑 Headers

### Authorization

**Key** : `Authorization`  
**Value** : `Bearer eyJhbGciOiJIUzI1NiIs...` (votre token JWT complet)

**Comment obtenir le token :**
1. Se connecter via `POST /auth/login/acteur`
2. Copier le `access_token` de la réponse
3. Ajouter `Bearer ` avant le token

**Exemple de token complet :**
```
Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTBjZGE0MmRjNjVhMWEzZmMyYzZhMjAiLCJyb2xlIjoiQUNURVVSIiwidHlwZSI6IkFDVEVVUiIsImVtYWlsIjoidXNlckB1c2VyLmNvbSIsImlhdCI6MTczNDU0MzAwMCwiZXhwIjoxNzY2MzU2NDYzfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Content-Type

**⚠️ NE PAS AJOUTER MANUELLEMENT**

Postman ajoutera automatiquement `Content-Type: multipart/form-data` quand vous utilisez l'onglet "Body" → "form-data".

---

## 📦 Body

### Configuration dans Postman

1. Sélectionner l'onglet **"Body"**
2. Sélectionner **"form-data"** (pas "raw" ni "binary")

### Cas 1 : Avec vidéo ET AI Feedback

| Key | Type | Value |
|-----|------|-------|
| `video` | File | [Sélectionner un fichier .mp4] |
| `aiFeedback` | Text | `{"globalScore":75,"emotions":{"detected":["joie"],"coherence":80,"intensity":70,"comment":"Bien"},"posture":{"score":70,"strengths":["Bonne posture"],"improvements":[],"comment":"Correct"},"intonation":{"score":75,"clarity":80,"rhythm":70,"expressiveness":75,"comment":"Bon"},"expressivite":{"score":80,"facialExpressions":"Expressif","bodyLanguage":"Naturel","comment":"Très bien"},"recommendations":["Varier le ton"],"strengths":["Bonne diction"],"summary":"Performance solide"}` |

### Cas 2 : Avec vidéo seulement

| Key | Type | Value |
|-----|------|-------|
| `video` | File | [Sélectionner un fichier .mp4] |

### Cas 3 : Sans vidéo (body vide)

Laisser le body vide ou envoyer seulement le AI Feedback si disponible.

| Key | Type | Value |
|-----|------|-------|
| `aiFeedback` | Text | `{"globalScore":75,...}` |

### Cas 4 : Sans vidéo ET sans AI Feedback (minimal)

Laisser le body **complètement vide** (aucune clé dans form-data).

---

## 🎬 Capture d'écran Postman

```
┌─────────────────────────────────────────────────────┐
│ POST  https://cast-mate.vercel.app/castings/.../apply │
└─────────────────────────────────────────────────────┘

Tabs: [ Params ] [ Authorization ] [★ Headers ] [ Body ]

╔═══════════════════════════════════════════════════╗
║ Headers                                           ║
╠═══════════════════════════════════════════════════╣
║ Key              │ Value                          ║
║ Authorization    │ Bearer eyJhbGciOiJIUzI1NiIs... ║
╚═══════════════════════════════════════════════════╝

Tabs: [ Params ] [ Authorization ] [ Headers ] [★ Body ]

╔═══════════════════════════════════════════════════╗
║ Body: ● form-data  ○ x-www-form-urlencoded        ║
╠═══════════════════════════════════════════════════╣
║ Key         │ Type │ Value                        ║
║ video       │ File │ [Select video.mp4]           ║
║ aiFeedback  │ Text │ {"globalScore":75,...}       ║
╚═══════════════════════════════════════════════════╝

[Send]  [Save]
```

---

## ✅ Réponse attendue (200 OK)

### Body

```json
{
  "message": "Candidature enregistrée avec succès",
  "candidat": {
    "acteurId": "690cda42dc65a1a3fc2c6a20",
    "datePostulation": "2024-12-14T23:30:00.000Z",
    "statut": "en_attente",
    "videoFileId": "675de5f6b8f9a0c1d2e3f4a5"  // Si vidéo uploadée
  }
}
```

### Headers

```
Content-Type: application/json
Date: Sun, 14 Dec 2025 23:30:00 GMT
```

---

## ❌ Erreurs possibles

### 401 Unauthorized

**Cause** : Token manquant ou invalide

**Réponse** :
```json
{
  "statusCode": 401,
  "message": "Token invalide ou expiré",
  "error": "Unauthorized"
}
```

**Solution** : Vérifier que le header `Authorization: Bearer <token>` est présent et que le token est valide.

### 403 Forbidden

**Cause** : Rôle incorrect (pas ACTEUR)

**Réponse** :
```json
{
  "statusCode": 403,
  "message": "Accès refusé. Rôles requis: ACTEUR. Votre rôle: RECRUTEUR",
  "error": "Forbidden"
}
```

**Solution** : Se connecter avec un compte ACTEUR, pas RECRUTEUR.

### 400 Bad Request

**Cause** : Casting fermé ou vidéo invalide

**Réponse** :
```json
{
  "statusCode": 400,
  "message": "Ce casting n'accepte plus de candidatures",
  "error": "Bad Request"
}
```

**Solution** : Vérifier que le casting est ouvert.

### 404 Not Found

**Cause** : ID du casting incorrect

**Réponse** :
```json
{
  "statusCode": 404,
  "message": "Casting non trouvé",
  "error": "Not Found"
}
```

**Solution** : Vérifier l'ID du casting dans l'URL.

### 409 Conflict

**Cause** : Déjà postulé

**Réponse** :
```json
{
  "statusCode": 409,
  "message": "Vous avez déjà postulé à ce casting",
  "error": "Conflict"
}
```

**Solution** : Normal, cet acteur a déjà postulé à ce casting.

---

## 🧪 Tests recommandés

### Test 1 : Candidature avec vidéo

1. Ajouter le token d'un ACTEUR
2. Sélectionner une vidéo (< 50 MB)
3. Optionnel : Ajouter le AI Feedback
4. Cliquer sur "Send"
5. Vérifier la réponse 200 OK

### Test 2 : Candidature sans vidéo

1. Ajouter le token d'un ACTEUR
2. Laisser le body vide (ou seulement AI Feedback)
3. Cliquer sur "Send"
4. Vérifier la réponse 200 OK

### Test 3 : Candidature avec mauvais token

1. Ajouter un token RECRUTEUR ou invalide
2. Cliquer sur "Send"
3. Vérifier la réponse 403 Forbidden

### Test 4 : Candidature à un casting fermé

1. Utiliser un casting avec `ouvert: false`
2. Cliquer sur "Send"
3. Vérifier la réponse 400 Bad Request

### Test 5 : Double candidature

1. Postuler une première fois (200 OK)
2. Postuler à nouveau avec le même acteur
3. Vérifier la réponse 409 Conflict

---

## 🔄 Comparaison Postman vs Android

### Ce que Postman fait automatiquement

1. **Content-Type** : Ajoute automatiquement `multipart/form-data` avec boundary
2. **Boundary** : Génère automatiquement la boundary pour séparer les parties
3. **Encoding** : Encode correctement les fichiers en base64

### Ce que votre code Android doit faire

```kotlin
// ✅ CORRECT - Similaire à Postman
val formData = MultipartBody.Builder()
    .setType(MultipartBody.FORM)  // Équivalent de "form-data" dans Postman
    .addFormDataPart(
        "video",                  // Nom du champ (comme "Key" dans Postman)
        videoFile.name,           // Nom du fichier
        videoFile.asRequestBody(  // Le fichier lui-même
            "video/mp4".toMediaTypeOrNull()
        )
    )
    .addFormDataPart(
        "aiFeedback",             // Nom du champ
        aiFeedbackJson            // Valeur texte (JSON string)
    )
    .build()

val request = Request.Builder()
    .url("https://cast-mate.vercel.app/castings/$castingId/apply")
    .post(formData)
    .addHeader("Authorization", "Bearer $token")
    // ❌ NE PAS ajouter Content-Type manuellement
    .build()
```

---

## 📋 Checklist de débogage

Si ça marche dans Postman mais pas dans Android :

- [ ] Le token est-il le même ?
- [ ] Le header Authorization est-il au même format ? (`Bearer <token>`)
- [ ] Le body est-il en `form-data` (pas en JSON ou raw) ?
- [ ] Les noms des champs sont-ils exacts ? (`video`, `aiFeedback`)
- [ ] Le fichier vidéo est-il correctement encodé ?
- [ ] Le AI Feedback est-il un JSON **string** (pas un objet) ?
- [ ] Y a-t-il d'autres headers ajoutés qui pourraient interférer ?
- [ ] Le Content-Type est-il ajouté automatiquement (ne pas le mettre manuellement) ?

---

## 🎯 Résumé

1. **Method** : POST
2. **URL** : `https://cast-mate.vercel.app/castings/{id}/apply`
3. **Headers** : `Authorization: Bearer <token>`
4. **Body** : `form-data` avec `video` (File) et `aiFeedback` (Text)
5. **Réponse** : 200 OK avec message de confirmation

Si ça marche dans Postman, ça doit marcher dans Android avec le même format. Comparez votre code Android avec la configuration Postman ci-dessus.

**Bon courage !** 🚀

