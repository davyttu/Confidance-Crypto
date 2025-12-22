// src/app/api/chat/route.js
// Route API Next.js pour le chat Marilyn via EventBus
// Version adaptée - Appelle directement le Chat Protocol n8n

import { NextResponse } from 'next/server';

// URL du Chat Protocol (point d'entrée vers EventBus → Marilyn)
const CHAT_PROTOCOL_URL = process.env.CHAT_PROTOCOL_URL || 'https://davyvittu.app.n8n.cloud/webhook/chat-protocol';

export async function POST(request) {
  try {
    // Récupérer le body de la requête
    const body = await request.json();

    console.log('📄 [Next.js API] Envoi vers Chat Protocol:', {
      message: body.message?.substring(0, 50),
      context: body.context,
      chatProtocolUrl: CHAT_PROTOCOL_URL
    });

    // Validation des données
    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Message requis',
          fallback: 'Veuillez entrer un message.'
        },
        { status: 400 }
      );
    }

    if (body.message.length > 1000) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Message trop long',
          fallback: 'Le message ne peut pas dépasser 1000 caractères.'
        },
        { status: 400 }
      );
    }

    // Préparer le payload pour le Chat Protocol (format attendu par N8N workflow)
    const payload = {
      user_id: body.context?.walletAddress || body.context?.wallet_address || 'anonymous',
      message: body.message.trim(),
      context: {
        page: body.context?.page || '/',
        network: body.context?.network || 'BASE',
        walletConnected: !!body.context?.walletAddress || !!body.context?.wallet_address,
        walletAddress: body.context?.walletAddress || body.context?.wallet_address,
        ...body.context
      },
      session_id: body.session_id || null,
      user_agent: request.headers.get('user-agent') || null,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
    };

    console.log('🚀 [Next.js API] Payload préparé pour Chat Protocol:', {
      user_id: payload.user_id?.substring(0, 10) + '...' || 'anonymous',
      messageLength: payload.message.length,
      page: payload.context.page,
      network: payload.context.network,
      walletConnected: payload.context.walletConnected,
      hasSessionId: !!payload.session_id
    });

    // Appeler le Chat Protocol
    const response = await fetch(CHAT_PROTOCOL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log('📥 [Next.js API] Response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
        // Essayer de parser comme JSON si possible
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ [Next.js API] Erreur Chat Protocol (JSON):', response.status, errorJson);
          
          return NextResponse.json(
            { 
              success: false,
              error: errorJson.error || `Chat Protocol error: ${response.status}`,
              fallback: errorJson.fallback || 'Une erreur s\'est produite. Veuillez réessayer.'
            },
            { status: response.status }
          );
        } catch {
          // Ce n'est pas du JSON, utiliser le texte brut
          console.error('❌ [Next.js API] Erreur Chat Protocol (texte):', response.status, errorText);
        }
      } catch (e) {
        errorText = 'Erreur lors de la lecture de la réponse';
        console.error('❌ [Next.js API] Erreur lecture réponse:', e);
      }
      
      // Service temporairement indisponible
      if (response.status === 503) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Chat temporairement indisponible',
            fallback: 'Nos serveurs sont en maintenance. Veuillez réessayer dans quelques instants.'
          },
          { status: 503 }
        );
      }

      // Timeout
      if (response.status === 504) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Délai dépassé',
            fallback: 'Le serveur met trop de temps à répondre. Veuillez réessayer.'
          },
          { status: 504 }
        );
      }

      // Erreur 500 - Format invalide du workflow N8N
      if (response.status === 500) {
        return NextResponse.json(
          { 
            success: false,
            error: errorText || 'Format invalide',
            fallback: 'Le workflow de chat a rencontré une erreur. Veuillez réessayer dans quelques instants.'
          },
          { status: 500 }
        );
      }

      // Autres erreurs serveur
      return NextResponse.json(
        { 
          success: false,
          error: `Chat Protocol error: ${response.status}`,
          fallback: errorText || 'Une erreur s\'est produite. Veuillez réessayer.'
        },
        { status: response.status }
      );
    }

    let data;
    try {
      const responseText = await response.text();
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Réponse vide du Chat Protocol');
      }
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ [Next.js API] Erreur parsing JSON:', parseError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Format invalide',
          fallback: 'La réponse du serveur est invalide. Le workflow N8N a peut-être renvoyé un format incorrect.'
        },
        { status: 500 }
      );
    }
    
    console.log('✅ [Next.js API] Réponse Chat Protocol reçue:', {
      success: data.success,
      hasMarilynResponse: !!data.marilyn_response,
      hasMessage: !!data.message,
      hasAnswer: !!data.answer,
      event_id: data.event_id,
      intent: data.intent,
      responseKeys: Object.keys(data)
    });

    // Vérifier que nous avons bien une réponse de Marilyn
    if (!data.marilyn_response && !data.message) {
      console.error('⚠️ [Next.js API] Pas de réponse de Marilyn dans:', data);
      return NextResponse.json(
        { 
          success: false,
          error: 'Réponse incomplète',
          fallback: 'Désolé, je n\'ai pas pu générer une réponse. Veuillez réessayer.'
        },
        { status: 500 }
      );
    }

    // Retourner au format attendu par le frontend (compatible avec ancien format)
    return NextResponse.json({
      success: true,
      answer: data.marilyn_response || data.message,
      intent: data.intent || 'information',
      confidence: data.confidence || 0.9,
      event_id: data.event_id,
      response_from: data.response_from || 'marilyn',
      timestamp: new Date().toISOString(),
      // Compatibilité avec l'ancien format
      marilyn_response: data.marilyn_response || data.message,
      message: data.marilyn_response || data.message
    });

  } catch (error) {
    console.error('❌ [Next.js API] Erreur:', error);

    // Erreur réseau
    if (error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Erreur réseau',
          fallback: 'Impossible de contacter le serveur. Vérifiez votre connexion.'
        },
        { status: 503 }
      );
    }

    // Erreur de parsing JSON
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Format invalide',
          fallback: 'La réponse du serveur est invalide.'
        },
        { status: 500 }
      );
    }

    // Autres erreurs
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        fallback: 'Une erreur est survenue. Veuillez réessayer.'
      },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  try {
    // Tester le Chat Protocol
    const response = await fetch(CHAT_PROTOCOL_URL, {
      method: 'GET'
    });

    return NextResponse.json({
      status: 'ok',
      service: 'Chat API via EventBus',
      version: '2.0',
      chatProtocolUrl: CHAT_PROTOCOL_URL,
      chatProtocolStatus: response.status === 405 || response.ok ? 'reachable' : 'unreachable',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
      chatProtocolUrl: CHAT_PROTOCOL_URL,
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}