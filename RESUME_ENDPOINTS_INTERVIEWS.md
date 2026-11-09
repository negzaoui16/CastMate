# 📋 Résumé des Endpoints Interviews - Backend Changes

## 🔄 Changements Effectués

### Nouveau Module
- **Module Interviews** créé avec schéma MongoDB, service, contrôleur et DTOs

### Modification du Module Castings
- Nouvelle route ajoutée : `POST /castings/:id/candidates/:acteurId/accept-with-interview`

---

## 📡 Endpoints Disponibles

### 1. Accepter candidat avec interview (RECRUTEUR/ADMIN)
```
POST /castings/:castingId/candidates/:acteurId/accept-with-interview
Body: { "proposedDates": [{ "date": "YYYY-MM-DD", "time": "HH:mm" }, ...] }
Réponse: { "casting": {...}, "interview": {...} }
```

### 2. Sélectionner une date (ACTEUR)
```
PATCH /interviews/:interviewId/select-date
Body: { "selectedDate": "YYYY-MM-DD", "selectedTime": "HH:mm" }
Réponse: Interview avec status="CONFIRMED"
```

### 3. Liste interviews acteur (ACTEUR)
```
GET /interviews/actor?status=PENDING|CONFIRMED|CANCELLED
Réponse: { "interviews": [...] }
```

### 4. Liste interviews agence (RECRUTEUR/ADMIN)
```
GET /interviews/agency?status=PENDING&castingId=...
Réponse: { "interviews": [...] }
```

### 5. Détails interview (ACTEUR/AGENCE)
```
GET /interviews/:interviewId
Réponse: Interview complète
```

### 6. Annuler interview (ACTEUR/AGENCE)
```
PATCH /interviews/:interviewId/cancel
Réponse: Interview avec status="CANCELLED"
```

---

## 📦 Structure Interview

```json
{
  "id": "string",
  "castingId": "string",
  "castingTitle": "string",
  "acteurId": "string",
  "acteurName": "string",
  "agenceId": "string",
  "agenceName": "string",
  "proposedDates": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:mm",
      "isSelected": boolean
    }
  ],
  "selectedDate": "YYYY-MM-DD",
  "selectedTime": "HH:mm",
  "status": "PENDING|CONFIRMED|CANCELLED",
  "createdAt": "ISO_DATE",
  "updatedAt": "ISO_DATE"
}
```

---

## ✅ Règles de Validation

1. **3 dates exactement** lors de la création
2. **Dates uniques** et **dans le futur**
3. **Date sélectionnée** doit être parmi les dates proposées
4. **Permissions** : Acteur = ses interviews, Agence = ses interviews

---

## 🔐 Authentification

Tous les endpoints requièrent :
```
Header: Authorization: Bearer <JWT_TOKEN>
```

