// app/api/contact/route.ts
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Adresse email de destination officielle
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'davyes0101@gmail.com';

// Configuration SMTP (Brevo recommandé)
const createTransporter = () => {
  const smtpHost = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const isSecure = smtpPort === 465;
  
  // Pour Brevo, SMTP_USER doit être 'apikey' par défaut
  // Pour Hostinger ou autres, SMTP_USER doit être l'adresse email complète
  const smtpUser = process.env.SMTP_USER || (smtpHost.includes('brevo') ? 'apikey' : '');
  
  const config = {
    host: smtpHost,
    port: smtpPort,
    secure: isSecure, // true pour 465, false pour 587 (STARTTLS)
    auth: {
      user: smtpUser,
      pass: process.env.SMTP_PASSWORD,
    },
    // Options supplémentaires pour améliorer la compatibilité
    tls: {
      rejectUnauthorized: false, // Accepte les certificats auto-signés (utile en dev)
    },
  };
  
  console.log('🔧 Création du transporteur SMTP avec la configuration:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user,
    passwordSet: !!config.auth.pass,
  });
  
  return nodemailer.createTransport(config);
};

const createSupabaseAdminClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn(
      '⚠️ Supabase admin client non configuré (SUPABASE_URL et SUPABASE_SERVICE_KEY requis).'
    );
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
  });
};

const logEmailNotification = async ({
  paymentId,
  email,
  type,
  status,
}: {
  paymentId?: string | null;
  email: string;
  type: string;
  status: 'sent' | 'failed';
}) => {
  try {
    const supabase = createSupabaseAdminClient();
    if (!supabase) return;

    const { error } = await supabase.from('email_notifications').insert([
      {
        payment_id: paymentId ?? null,
        email,
        type,
        status,
      },
    ]);

    if (error) {
      console.error('❌ Erreur insertion email_notifications:', error);
    } else {
      console.log('✅ Notification email enregistrée en base');
    }
  } catch (logError) {
    console.error('❌ Erreur logging email notification:', logError);
  }
};

export async function POST(request: NextRequest) {
  let senderEmail = '';
  try {
    // Vérifier que SMTP est configuré
    const smtpHost = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
    const smtpPort = process.env.SMTP_PORT || '587';
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    
    // Logs de diagnostic (sans exposer les mots de passe)
    console.log('📋 Configuration SMTP détectée:');
    console.log('  - SMTP_HOST:', smtpHost);
    console.log('  - SMTP_PORT:', smtpPort);
    console.log('  - SMTP_USER:', smtpUser || '(non défini)');
    console.log('  - SMTP_PASSWORD:', smtpPassword ? '✅ défini' : '❌ manquant');
    
    if (!smtpPassword) {
      console.error('❌ SMTP_PASSWORD manquant dans les variables d\'environnement');
      return NextResponse.json(
        { error: 'Configuration SMTP manquante (SMTP_PASSWORD requis). Vérifiez votre fichier .env.local' },
        { status: 500 }
      );
    }
    
    // Pour Brevo, SMTP_USER doit être 'apikey' si non défini
    // Pour Hostinger, SMTP_USER doit être l'adresse email complète
    if (!smtpUser && smtpHost.includes('brevo')) {
      console.log('⚠️ SMTP_USER non défini, utilisation de "apikey" par défaut pour Brevo');
    } else if (!smtpUser && smtpHost.includes('hostinger')) {
      console.error('❌ SMTP_USER manquant - requis pour Hostinger (doit être votre adresse email complète)');
      return NextResponse.json(
        { error: 'Configuration SMTP manquante (SMTP_USER requis pour Hostinger). Vérifiez votre fichier .env.local' },
        { status: 500 }
      );
    }

    const body = await request.json();
    
    const { email, subject, message } = body;
    senderEmail = email;

    // Validation des champs requis
    if (!email || !subject || !message) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis (email, sujet, message)' },
        { status: 400 }
      );
    }

    // Validation basique de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Adresse email invalide' },
        { status: 400 }
      );
    }

    // Validation des longueurs
    if (subject.length > 200) {
      return NextResponse.json(
        { error: 'Le sujet ne peut pas dépasser 200 caractères' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Le message ne peut pas dépasser 5000 caractères' },
        { status: 400 }
      );
    }

    console.log('📧 Préparation de l\'email de contact depuis:', email);

    // Créer le contenu HTML de l'email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 10px 10px;
              border: 1px solid #e5e7eb;
            }
            .field {
              margin-bottom: 20px;
              padding: 15px;
              background: white;
              border-radius: 8px;
              border-left: 4px solid #667eea;
            }
            .label {
              font-weight: bold;
              color: #4f46e5;
              display: block;
              margin-bottom: 5px;
            }
            .value {
              color: #374151;
              white-space: pre-wrap;
            }
            .message-content {
              background: white;
              padding: 20px;
              border-radius: 8px;
              border-left: 3px solid #667eea;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0;">📧 Nouveau message de contact</h1>
          </div>
          <div class="content">
            <div class="field">
              <span class="label">👤 Email de l'expéditeur</span>
              <span class="value">${email}</span>
            </div>
            
            <div class="field">
              <span class="label">📝 Sujet</span>
              <span class="value">${subject}</span>
            </div>
            
            <div class="message-content">
              <span class="label">💬 Message</span>
              <div class="value">${message.replace(/\n/g, '<br>')}</div>
            </div>
            
            <div class="footer">
              <p>Ce message a été envoyé depuis le formulaire de contact de Confidance Crypto.</p>
              <p>Répondez directement à cet email pour contacter l'expéditeur.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Créer le transporteur SMTP
    const transporter = createTransporter();
    
    // Vérifier la connexion SMTP avant d'envoyer
    try {
      await transporter.verify();
      console.log('✅ Connexion SMTP vérifiée avec succès');
    } catch (verifyError) {
      console.error('❌ Erreur de vérification SMTP:', verifyError);
      throw new Error(`Échec de la connexion SMTP: ${verifyError instanceof Error ? verifyError.message : 'Erreur inconnue'}`);
    }
    
    // Adresse email d'expéditeur
    // Pour Brevo: doit être une adresse email vérifiée dans votre compte Brevo
    // Si vous utilisez un domaine personnalisé, vous devez d'abord le vérifier dans Brevo
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_EMAIL || CONTACT_EMAIL;
    
    console.log('📤 Envoi de l\'email via SMTP depuis:', fromEmail, 'vers:', CONTACT_EMAIL);
    console.log('📋 Configuration complète:', {
      from: fromEmail,
      to: CONTACT_EMAIL,
      smtpHost: smtpHost,
    });
    
    // Envoyer l'email via SMTP
    const mailOptions = {
      from: `Confidance Crypto <${fromEmail}>`,
      to: CONTACT_EMAIL,
      replyTo: email, // Permettre de répondre directement à l'expéditeur
      subject: `[Contact Confidance] ${subject}`,
      html: emailHtml,
      // Options supplémentaires pour Brevo
      headers: {
        'X-Mailer': 'Confidance Crypto Contact Form',
      },
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email de contact envoyé:', info.messageId);
    await logEmailNotification({
      paymentId: null,
      email: senderEmail,
      type: 'contact_form',
      status: 'sent',
    });

    return NextResponse.json({
      success: true,
      message: 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.',
    });

  } catch (error) {
    console.error('❌ Erreur API contact:', error);
    if (senderEmail) {
      await logEmailNotification({
        paymentId: null,
        email: senderEmail,
        type: 'contact_form',
        status: 'failed',
      });
    }
    
    let errorMessage = 'Erreur lors de l\'envoi de l\'email';
    let detailedMessage = '';
    
    if (error instanceof Error) {
      detailedMessage = error.message;
      
      // Gestion des erreurs SMTP spécifiques
      if (error.message.includes('Invalid login') || 
          error.message.includes('authentication failed') ||
          error.message.includes('Authentication failed') ||
          error.message.includes('Invalid credentials') ||
          error.message.includes('535') ||
          error.message.includes('550') ||
          error.message.includes('Sender address rejected')) {
        errorMessage = 'Erreur d\'authentification SMTP. Vérifiez vos identifiants et l\'adresse email FROM';
        console.error('💡 Vérifiez que:');
        console.error('   - Pour Brevo:');
        console.error('     * SMTP_USER=apikey (littéralement)');
        console.error('     * SMTP_PASSWORD est votre clé API Brevo valide (format: xkeysib-...)');
        console.error('     * SMTP_FROM_EMAIL doit être une adresse email vérifiée dans votre compte Brevo');
        console.error('     * Si vous utilisez un domaine personnalisé, vérifiez-le d\'abord dans Brevo (Settings > Senders & IP)');
        console.error('   - Pour Hostinger: SMTP_USER=votre_email@confidance-defi.com et SMTP_PASSWORD=votre_mot_de_passe');
        console.error('   - Redémarrez le serveur Next.js après avoir modifié .env.local');
      } else if (error.message.includes('ECONNREFUSED') || 
                 error.message.includes('ETIMEDOUT') ||
                 error.message.includes('ENOTFOUND')) {
        errorMessage = 'Impossible de se connecter au serveur SMTP. Vérifiez SMTP_HOST et SMTP_PORT';
        console.error('💡 Vérifiez SMTP_HOST et SMTP_PORT dans .env.local');
      } else if (error.message.includes('self signed certificate') ||
                 error.message.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE')) {
        errorMessage = 'Erreur de certificat SSL. Vérifiez la configuration SMTP';
      } else if (error.message.includes('Échec de la connexion SMTP')) {
        errorMessage = error.message;
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        message: detailedMessage,
      },
      { 
        status: 500,
      }
    );
  }
}
