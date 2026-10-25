// app/api/email/transaction/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { chainDisplayName, explorerAddressUrl, explorerDisplayName } from '@/lib/explorer';

export async function POST(request: NextRequest) {
  try {
    // Vérifier que Brevo est configuré
    console.log('🔍 Vérification des variables d\'environnement...');
    console.log('BREVO_API_KEY présente:', !!process.env.BREVO_API_KEY);
    console.log('BREVO_FROM_EMAIL:', process.env.BREVO_FROM_EMAIL);

    if (!process.env.BREVO_API_KEY || !process.env.BREVO_FROM_EMAIL) {
      console.error('❌ BREVO_API_KEY ou BREVO_FROM_EMAIL manquante');
      return NextResponse.json(
        { error: 'Configuration Brevo manquante' },
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
      network,
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
    const paymentNetwork = typeof network === 'string' && network.trim() ? network.trim() : 'base_mainnet';
    const basescanUrl = `https://basescan.org/address/${contractAddress}`;
    const contractUrl = contractAddress
      ? explorerAddressUrl(contractAddress, paymentNetwork)
      : basescanUrl;
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`;

    console.log('📧 Préparation de l\'email pour:', recipientEmail);
    console.log('📊 Statut du paiement:', status);
    console.log('📦 Type de paiement:', paymentType);

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
        basescanUrl: contractUrl,
        dashboardUrl,
        paymentType,
        cancellable,
        networkName: chainDisplayName(paymentNetwork),
        explorerName: explorerDisplayName(paymentNetwork),
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

    const fromEmail = process.env.BREVO_FROM_EMAIL;
    console.log('📤 Envoi de l\'email via Brevo API REST depuis:', fromEmail);

    // Envoyer l'email via l'API REST de Brevo
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: 'Confidance-defi',
          email: fromEmail
        },
        to: [
          {
            email: recipientEmail,
            name: recipientName || recipientEmail
          }
        ],
        subject: `📊 Récapitulatif de votre paiement - ${amount} ${tokenSymbol}`,
        htmlContent: emailHtml
      })
    });

    if (!brevoResponse.ok) {
      const errorData = await brevoResponse.json().catch(() => ({}));
      console.error('❌ Erreur Brevo API:', errorData);

      return NextResponse.json(
        {
          error: 'Erreur lors de l\'envoi via Brevo',
          details: errorData.message || 'Erreur inconnue',
          code: errorData.code
        },
        { status: brevoResponse.status }
      );
    }

    const brevoData = await brevoResponse.json();
    console.log('✅ Email envoyé via Brevo API:', brevoData);

    return NextResponse.json({
      success: true,
      message: 'Email envoyé avec succès',
      emailId: brevoData.messageId,
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
