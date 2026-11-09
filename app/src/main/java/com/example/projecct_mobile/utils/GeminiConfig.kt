package com.example.projecct_mobile.utils

/**
 * Configuration centralisée pour Gemini AI
 * Utilisée pour le chatbot agence et l'entraînement acteur
 */
object GeminiConfig {
    /**
     * Clé API Gemini partagée pour toute l'application
     * Obtenez votre clé sur : https://aistudio.google.com/app/apikey
     */
    const val GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"
    
    /**
     * Modèles Gemini disponibles
     */
    const val MODEL_FLASH = "gemini-1.5-flash"  // Rapide et économique
    const val MODEL_PRO = "gemini-1.5-pro"      // Plus performant mais plus cher
    const val MODEL_PRO_2_5 = "gemini-2.5-pro" // Modèle utilisé par le chatbot
    
    /**
     * URL de base pour l'API Gemini
     */
    const val BASE_URL = "https://generativelanguage.googleapis.com/"
}
