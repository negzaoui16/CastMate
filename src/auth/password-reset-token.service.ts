import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PasswordResetToken, PasswordResetTokenDocument } from './schemas/password-reset-token.schema';
import * as crypto from 'crypto';

/**
 * Service de gestion des tokens de réinitialisation de mot de passe
 * 
 * Ce service gère :
 * - La génération de tokens sécurisés pour réinitialiser les mots de passe
 * - Le stockage des tokens dans la base de données
 * - La validation des tokens (vérifier qu'ils existent, ne sont pas expirés, etc.)
 * - Le marquage des tokens comme utilisés (pour éviter la réutilisation)
 * - Le nettoyage des tokens expirés
 * 
 * Exemple d'utilisation :
 * - Un utilisateur oublie son mot de passe
 * - On génère un token unique : "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
 * - On stocke ce token avec l'email et une date d'expiration (1 heure)
 * - L'utilisateur reçoit un email avec un lien contenant ce token
 * - Quand il clique sur le lien, on vérifie que le token est valide
 * - Après réinitialisation, on marque le token comme utilisé
 */
@Injectable()
export class PasswordResetTokenService {
  constructor(
    // Injection du modèle MongoDB pour la collection "password-reset-tokens"
    // Ce modèle permet de faire des opérations CRUD (Create, Read, Update, Delete) sur les tokens
    @InjectModel(PasswordResetToken.name)
    private tokenModel: Model<PasswordResetTokenDocument>,
  ) {}

  /**
   * Génère un token sécurisé de 32 octets (64 caractères hexadécimaux)
   * 
   * Fonctionnement :
   * - crypto.randomBytes(32) génère 32 octets aléatoires (256 bits)
   * - .toString('hex') convertit ces octets en une chaîne hexadécimale
   * 
   * Exemple de résultat :
   * "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
   * 
   * Pourquoi 32 octets ?
   * - 32 octets = 256 bits = très sécurisé (impossible à deviner)
   * - C'est la taille recommandée pour les tokens de sécurité
   * 
   * @returns Une chaîne de 64 caractères hexadécimaux (0-9, a-f)
   */
  generateToken(): string {
    // crypto.randomBytes(32) génère 32 octets aléatoires
    // Exemple : [0xa1, 0xb2, 0xc3, ...] (32 nombres entre 0 et 255)
    // .toString('hex') convertit en hexadécimal
    // Exemple : "a1b2c3d4e5f6..."
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Stocke un token de réinitialisation dans la base de données
   * 
   * Fonctionnement :
   * 1. Si un token est fourni (vient d'Android), on l'utilise
   * 2. Sinon, on génère un nouveau token aléatoire
   * 3. On supprime les anciens tokens non utilisés pour cet email (pour éviter les doublons)
   * 4. On crée un nouveau document dans la base de données avec le token, l'email, le type, et la date d'expiration
   * 
   * @param email - L'email de l'utilisateur qui demande la réinitialisation
   * @param userType - Le type d'utilisateur : "ACTEUR" ou "RECRUTEUR"
   * @param token - Optionnel : un token fourni par Android. Si non fourni, on en génère un nouveau
   * @returns Le token stocké (généré ou fourni)
   * 
   * Exemple :
   * Input: email = "acteur@example.com", userType = "ACTEUR", token = undefined
   * Processus :
   *   1. Génère un token : "a1b2c3d4e5f6..."
   *   2. Supprime les anciens tokens pour "acteur@example.com"
   *   3. Crée un document : { email: "acteur@example.com", userType: "ACTEUR", token: "a1b2c3d4...", expiresAt: "2024-01-15T14:00:00", used: false }
   * Output: "a1b2c3d4e5f6..."
   */
  async storeToken(
    email: string, // Email de l'utilisateur (ex: "acteur@example.com")
    userType: 'ACTEUR' | 'RECRUTEUR', // Type d'utilisateur
    token?: string, // Token optionnel (si fourni par Android)
  ): Promise<string> {
    // ÉTAPE 1 : Déterminer le token à utiliser
    // Si un token est fourni (vient d'Android), on l'utilise tel quel
    // Sinon, on génère un nouveau token aléatoire
    //
    // Exemple avec token fourni :
    //   token = "token-from-android-123"
    //   resetToken = "token-from-android-123"
    //
    // Exemple sans token fourni :
    //   token = undefined
    //   resetToken = "a1b2c3d4e5f6..." (généré aléatoirement)
    const resetToken = token || this.generateToken();

    // ÉTAPE 2 : Calculer la date d'expiration (1 heure après maintenant)
    // Le token expire après 1 heure pour des raisons de sécurité
    // Si l'utilisateur ne réinitialise pas son mot de passe dans l'heure, il devra redemander
    //
    // Exemple :
    //   Maintenant : 2024-01-15 13:00:00
    //   Expiration : 2024-01-15 14:00:00 (1 heure plus tard)
    const expiresAt = new Date(); // Date actuelle
    expiresAt.setHours(expiresAt.getHours() + 1); // Ajouter 1 heure

    // ÉTAPE 3 : Supprimer les anciens tokens non utilisés pour cet email et ce type
    // Pourquoi supprimer les anciens tokens ?
    // - Éviter d'avoir plusieurs tokens valides en même temps
    // - Nettoyer la base de données
    // - Sécurité : si quelqu'un a intercepté un ancien token, il ne sera plus valide
    //
    // Exemple :
    //   Avant : Il y a 3 tokens pour "acteur@example.com" avec used: false
    //   Après : Tous les anciens tokens sont supprimés
    await this.tokenModel.deleteMany({
      email, // Email de l'utilisateur
      userType, // Type d'utilisateur (ACTEUR ou RECRUTEUR)
      used: false, // Seulement les tokens non utilisés
    });

    // ÉTAPE 4 : Créer un nouveau document dans la base de données
    // Ce document contient toutes les informations nécessaires pour valider le token plus tard
    //
    // Structure du document créé :
    // {
    //   email: "acteur@example.com",
    //   userType: "ACTEUR",
    //   token: "a1b2c3d4e5f6...",
    //   expiresAt: Date("2024-01-15T14:00:00"),
    //   used: false
    // }
    await this.tokenModel.create({
      email, // Email de l'utilisateur
      userType, // Type d'utilisateur
      token: resetToken, // Le token (généré ou fourni)
      expiresAt, // Date d'expiration (1 heure après maintenant)
      used: false, // Le token n'a pas encore été utilisé
    });

    // ÉTAPE 5 : Retourner le token stocké
    // Ce token sera utilisé pour créer le lien de réinitialisation
    return resetToken;
  }

  /**
   * Valide et récupère un token de réinitialisation
   * 
   * Fonctionnement :
   * 1. On cherche le token dans la base de données
   * 2. On vérifie qu'il existe, qu'il correspond à l'email, et qu'il n'a pas été utilisé
   * 3. On vérifie qu'il n'est pas expiré
   * 4. Si tout est OK, on retourne le document du token
   * 
   * @param token - Le token à valider (ex: "a1b2c3d4e5f6...")
   * @param email - L'email associé au token (ex: "acteur@example.com")
   * @returns Le document du token si valide
   * @throws NotFoundException si le token n'existe pas ou a été utilisé
   * @throws BadRequestException si le token est expiré
   * 
   * Exemple :
   * Input: token = "a1b2c3d4e5f6...", email = "acteur@example.com"
   * Processus :
   *   1. Cherche dans la base : { token: "a1b2c3d4...", email: "acteur@example.com", used: false }
   *   2. Vérifie que expiresAt > maintenant
   *   3. Si OK, retourne le document
   * Output: { email: "acteur@example.com", userType: "ACTEUR", token: "a1b2c3d4...", expiresAt: Date, used: false }
   */
  async validateToken(
    token: string, // Le token fourni par l'utilisateur
    email: string, // L'email fourni par l'utilisateur
  ): Promise<PasswordResetTokenDocument> {
    // ÉTAPE 1 : Chercher le token dans la base de données
    // On cherche un document qui correspond à :
    // - Le token fourni
    // - L'email fourni
    // - used: false (le token n'a pas encore été utilisé)
    //
    // Exemple de recherche :
    //   token = "a1b2c3d4e5f6..."
    //   email = "acteur@example.com"
    //   On cherche : { token: "a1b2c3d4...", email: "acteur@example.com", used: false }
    const resetToken = await this.tokenModel.findOne({
      token, // Le token doit correspondre exactement
      email, // L'email doit correspondre exactement
      used: false, // Le token ne doit pas avoir été utilisé
    });

    // ÉTAPE 2 : Vérifier que le token existe
    // Si resetToken est null, cela signifie qu'aucun document n'a été trouvé
    // Cela peut arriver si :
    // - Le token est incorrect
    // - L'email ne correspond pas
    // - Le token a déjà été utilisé (used: true)
    if (!resetToken) {
      throw new NotFoundException('Token introuvable');
    }

    // ÉTAPE 3 : Vérifier que le token n'est pas expiré
    // On compare la date d'expiration avec la date actuelle
    // Si expiresAt < maintenant, le token est expiré
    //
    // Exemple :
    //   expiresAt = 2024-01-15 14:00:00
    //   maintenant = 2024-01-15 15:00:00
    //   expiresAt < maintenant → Token expiré ❌
    //
    // Exemple valide :
    //   expiresAt = 2024-01-15 14:00:00
    //   maintenant = 2024-01-15 13:30:00
    //   expiresAt > maintenant → Token valide ✅
    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Token expiré');
    }

    // ÉTAPE 4 : Retourner le document du token si tout est valide
    // Ce document contient toutes les informations nécessaires (email, userType, etc.)
    return resetToken;
  }

  /**
   * Marque un token comme utilisé après réinitialisation réussie
   * 
   * Fonctionnement :
   * - Une fois que l'utilisateur a réinitialisé son mot de passe avec succès
   * - On marque le token comme "used: true" dans la base de données
   * - Cela empêche de réutiliser le même token plusieurs fois (sécurité)
   * 
   * @param token - Le token à marquer comme utilisé
   * 
   * Exemple :
   * Input: token = "a1b2c3d4e5f6..."
   * Processus :
   *   1. Cherche le document avec ce token
   *   2. Met à jour used: false → used: true
   *   3. Le token ne pourra plus être utilisé pour réinitialiser le mot de passe
   */
  async markAsUsed(token: string): Promise<void> {
    // Mettre à jour le document dans la base de données
    // On cherche le document avec ce token et on change used: false → used: true
    //
    // Exemple :
    //   Avant : { token: "a1b2c3d4...", email: "acteur@example.com", used: false }
    //   Après : { token: "a1b2c3d4...", email: "acteur@example.com", used: true }
    await this.tokenModel.updateOne(
      { token }, // Condition : trouver le document avec ce token
      { used: true }, // Mise à jour : mettre used à true
    );
  }

  /**
   * Nettoie les tokens expirés de la base de données
   * 
   * Fonctionnement :
   * - Supprime tous les tokens dont la date d'expiration est passée
   * - Cette fonction peut être appelée périodiquement (ex: tous les jours) pour nettoyer la base
   * - Utile pour éviter d'avoir trop de documents inutiles dans la base de données
   * 
   * @returns Le nombre de tokens supprimés
   * 
   * Exemple :
   *   Maintenant : 2024-01-15 15:00:00
   *   Tokens expirés : 
   *     - { token: "abc123", expiresAt: "2024-01-15 13:00:00" } → Supprimé ✅
   *     - { token: "def456", expiresAt: "2024-01-15 14:00:00" } → Supprimé ✅
   *     - { token: "ghi789", expiresAt: "2024-01-15 16:00:00" } → Gardé ✅
   *   Résultat : 2 tokens supprimés
   */
  async cleanupExpiredTokens(): Promise<number> {
    // Supprimer tous les documents dont expiresAt < maintenant
    // $lt signifie "less than" (inférieur à)
    //
    // Exemple :
    //   expiresAt: { $lt: new Date() } signifie "expiresAt < maintenant"
    //   Donc on supprime tous les tokens expirés
    const result = await this.tokenModel.deleteMany({
      expiresAt: { $lt: new Date() }, // expiresAt < date actuelle
    });
    
    // Retourner le nombre de tokens supprimés
    // deletedCount contient le nombre de documents supprimés
    // Si aucun document n'a été supprimé, on retourne 0
    return result.deletedCount || 0;
  }
}

