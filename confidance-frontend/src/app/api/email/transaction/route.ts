// app/api/email/transaction/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { render } from '@react-email/render';

// Initialiser Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    // Vérifier que Resend est configuré
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY manquante');
      return NextResponse.json(
        { error: 'Configuration Resend manquante' },
        { status: 500 }
      );
    }

    const body = await request.json();
    
    const {
      recipientEmail,
      recipientName,
      senderAddress,
      beneficiaryAddress,
      beneficiaryName,
      amount,
      tokenSymbol,
      releaseDate,
      status,
      contractAddress,
      transactionHash,
      paymentType,
      cancellable,
    } = body;

    // Validation
    if (!recipientEmail || !senderAddress || !beneficiaryAddress || !amount) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      );
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json(
        { error: 'Email invalide' },
        { status: 400 }
      );
    }

    // URLs
    const basescanUrl = `https://basescan.org/address/${contractAddress}`;
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`;

    console.log('📧 Préparation de l\'email pour:', recipientEmail);

    // Importer dynamiquement le composant React Email
    let emailHtml;
    try {
      console.log('📦 Import du composant TransactionReceipt...');
      const TransactionReceiptEmailModule = await import('@/emails/TransactionReceipt');
      console.log('✅ Module importé:', Object.keys(TransactionReceiptEmailModule));
      
      const TransactionReceiptEmail = TransactionReceiptEmailModule.default || TransactionReceiptEmailModule.TransactionReceiptEmail;
      
      if (!TransactionReceiptEmail) {
        console.error('❌ Composant non trouvé dans le module:', TransactionReceiptEmailModule);
        throw new Error('Composant TransactionReceiptEmail non trouvé dans le module');
      }
      
      console.log('✅ Composant trouvé, type:', typeof TransactionReceiptEmail);
      
      // Créer l'élément React pour l'email en utilisant le composant comme fonction
      const emailComponent = TransactionReceiptEmail({
        recipientName,
        senderAddress,
        beneficiaryAddress,
        beneficiaryName,
        amount,
        tokenSymbol,
        releaseDate,
        status,
        contractAddress,
        transactionHash,
        basescanUrl,
        dashboardUrl,
        paymentType,
        cancellable,
      });
      
      console.log('✅ Composant React créé');

      // Rendre le composant React en HTML
      console.log('🔄 Rendu du composant en HTML...');
      emailHtml = await render(emailComponent);
      console.log('✅ HTML généré, longueur:', emailHtml.length);
    } catch (importError) {
      console.error('❌ Erreur import/rendu email:', importError);
      if (importError instanceof Error) {
        console.error('❌ Message:', importError.message);
        console.error('❌ Stack trace:', importError.stack);
      } else {
        console.error('❌ Erreur non-Error:', JSON.stringify(importError, null, 2));
      }
      throw new Error(`Erreur import/rendu email: ${importError instanceof Error ? importError.message : 'Erreur inconnue'}`);
    }

    // Déterminer l'adresse email d'expéditeur
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Confidance Crypto <onboarding@resend.dev>';
    console.log('📤 Envoi de l\'email via Resend depuis:', fromEmail);
    
    // Envoyer l'email
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [recipientEmail],
      subject: `💎 Récapitulatif de votre paiement - ${amount} ${tokenSymbol}`,
      html: emailHtml,
    });

    if (error) {
      console.error('❌ Erreur Resend:', error);
      console.error('❌ Type d\'erreur:', typeof error);
      console.error('❌ Détails Resend:', JSON.stringify(error, null, 2));
      
      // Messages d'erreur plus spécifiques
      let errorMessage = 'Erreur lors de l\'envoi de l\'email';
      let errorCode = 'UNKNOWN_ERROR';
      
      if (error.message) {
        errorMessage = error.message;
        
        // Détecter l'erreur de domaine non vérifié
        if (error.message.includes('testing emails') || error.message.includes('verify a domain')) {
          errorMessage = 'Compte Resend en mode test : Vous ne pouvez envoyer des emails qu\'à votre adresse email (davyes0101@gmail.com) tant qu\'aucun domaine n\'est vérifié. Pour envoyer à d\'autres adresses, vérifiez un domaine sur resend.com/domains';
          errorCode = 'DOMAIN_NOT_VERIFIED';
        } else if (error.name === 'UnauthorizedError' || error.message?.includes('API key')) {
          errorMessage = 'Clé API Resend invalide ou manquante. Vérifiez RESEND_API_KEY dans .env.local';
          errorCode = 'INVALID_API_KEY';
        } else if (error.message?.includes('domain')) {
          errorMessage = 'Domaine email non vérifié dans Resend. Vérifiez la configuration du domaine.';
          errorCode = 'DOMAIN_NOT_VERIFIED';
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          errorCode,
          details: error.message || (typeof error === 'string' ? error : JSON.stringify(error)),
          resendError: error
        },
        { status: 500 }
      );
    }

    console.log('✅ Email envoyé:', data);

    return NextResponse.json({
      success: true,
      message: 'Email envoyé avec succès',
      emailId: data?.id,
    });

  } catch (error) {
    console.error('❌ Erreur API email:', error);
    
    // Log détaillé pour le débogage
    if (error instanceof Error) {
      console.error('❌ Message d\'erreur:', error.message);
      console.error('❌ Stack:', error.stack);
    } else {
      console.error('❌ Erreur non-Error:', JSON.stringify(error, null, 2));
    }
    
    // Retourner une réponse JSON avec les bons headers
    return NextResponse.json(
      { 
        error: 'Erreur serveur',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
        type: error instanceof Error ? error.constructor.name : typeof error
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}
