// 🔄 PROXY API MARILYN - Résout le problème CORS
// src/app/api/marilyn/route.js

import { NextResponse } from 'next/server';

const N8N_WEBHOOK_URL = "https://davyvittu.app.n8n.cloud/webhook/super-agent";

export async function POST(request) {
  try {
    // Lire le body de la requête
    const body = await request.json();

    console.log('📤 [Proxy Marilyn] Requête reçue:', {
      source: body.source,
      channel: body.channel,
      user_id: body.user_id,
      message: body.message?.substring(0, 50)
    });

    // Transférer à n8n Cloud
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    console.log('📥 [Proxy Marilyn] Réponse n8n:', response.status, response.statusText);

    // Vérifier la réponse
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Proxy Marilyn] Erreur n8n:', response.status, errorText);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Erreur n8n (${response.status})`,
          details: errorText
        },
        { status: response.status }
      );
    }

    // Lire la réponse de n8n
    const data = await response.json();
    
    console.log('✅ [Proxy Marilyn] Réponse transmise:', data);

    // Retourner au frontend avec headers CORS
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error('❌ [Proxy Marilyn] Erreur:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erreur interne du proxy',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
