// emails/TransactionReceipt.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import * as React from 'react';

interface TransactionReceiptEmailProps {
  recipientName?: string;
  senderAddress: string;
  beneficiaryAddress: string;
  beneficiaryName?: string;
  amount: string;
  tokenSymbol: string;
  releaseDate: string;
  status: 'pending' | 'released' | 'cancelled' | 'failed';
  contractAddress: string;
  transactionHash?: string;
  basescanUrl: string;
  dashboardUrl: string;
  paymentType?: string;
  cancellable?: boolean;
}

const statusLabels = {
  pending: { label: 'En cours', color: '#f59e0b', emoji: '⏳' },
  released: { label: 'Exécuté', color: '#10b981', emoji: '✅' },
  cancelled: { label: 'Annulé', color: '#6b7280', emoji: '🚫' },
  failed: { label: 'Échoué', color: '#ef4444', emoji: '❌' },
};

export const TransactionReceiptEmail = ({
  recipientName = 'Cher utilisateur',
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
}: TransactionReceiptEmailProps) => {
  // Valeur par défaut si le status n'est pas reconnu
  const statusInfo = statusLabels[status] || statusLabels['pending'];
  const displayBeneficiary = beneficiaryName || `${beneficiaryAddress.slice(0, 6)}...${beneficiaryAddress.slice(-4)}`;

  return (
    <Html>
      <Head />
      <Preview>
        Récapitulatif de votre paiement programmé - {amount} {tokenSymbol}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo - Repris de la navbar */}
          <Section style={logoSection}>
            <table cellPadding="0" cellSpacing="0" border={0} style={{ margin: '0 auto' }}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
                    <table cellPadding="0" cellSpacing="0" border={0} style={logoIcon}>
                      <tbody>
                        <tr>
                          <td style={logoIconText}>C</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <span style={logoText}>Confidance</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <Text style={tagline}>Paiements programmés décentralisés</Text>
          </Section>

          {/* Message d'accueil */}
          <Section style={greetingSection}>
            <Heading style={greeting}>Bonjour {recipientName} 👋</Heading>
            <Text style={introText}>
              Voici le récapitulatif de votre paiement programmé sur la blockchain Base.
            </Text>
          </Section>

          {/* Card principale */}
          <Section style={cardSection}>
            {/* Statut */}
            <Section style={statusBadge(statusInfo.color)}>
              <Text style={statusText}>
                {statusInfo.emoji} {statusInfo.label}
              </Text>
            </Section>

            {/* Montant principal */}
            <Section style={amountSection}>
              <Text style={amountLabel}>Montant</Text>
              <Heading style={amountValue}>
                {amount} {tokenSymbol}
              </Heading>
            </Section>

            <Hr style={divider} />

            {/* Détails */}
            <Section style={detailsSection}>
              <table style={detailsTable}>
                <tr>
                  <td style={labelCell}>De :</td>
                  <td style={valueCell}>
                    {senderAddress.slice(0, 10)}...{senderAddress.slice(-8)}
                  </td>
                </tr>
                <tr>
                  <td style={labelCell}>À :</td>
                  <td style={valueCell}>{displayBeneficiary}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Date de libération :</td>
                  <td style={valueCell}>{releaseDate}</td>
                </tr>
                {paymentType && (
                  <tr>
                    <td style={labelCell}>Type de paiement :</td>
                    <td style={valueCell}>{paymentType}</td>
                  </tr>
                )}
                {cancellable !== undefined && (
                  <tr>
                    <td style={labelCell}>Annulation :</td>
                    <td style={valueCell}>
                      {cancellable ? 'Annulable' : 'Non-annulable'}
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={labelCell}>Contrat :</td>
                  <td style={valueCell}>
                    {contractAddress.slice(0, 10)}...{contractAddress.slice(-8)}
                  </td>
                </tr>
                {transactionHash && (
                  <tr>
                    <td style={labelCell}>Transaction :</td>
                    <td style={valueCell}>
                      {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                    </td>
                  </tr>
                )}
              </table>
            </Section>

            <Hr style={divider} />

            {/* Boutons d'action */}
            <Section style={buttonSection}>
              <Button style={primaryButton} href={dashboardUrl}>
                📊 Voir dans le Dashboard
              </Button>
              <Button style={secondaryButton} href={basescanUrl}>
                🔍 Voir sur Basescan
              </Button>
            </Section>
          </Section>

          {/* Sécurité */}
          <Section style={infoSection}>
            <Text style={infoTitle}>🔒 Sécurité</Text>
            <Text style={infoText}>
              Ce paiement est sécurisé par un smart contract sur la blockchain Base. 
              Aucune partie ne peut modifier les termes après création. Les fonds sont 
              protégés par la technologie blockchain et seront automatiquement libérés selon 
              les conditions définies.
            </Text>
          </Section>

          {/* Footer */}
          <Hr style={footerDivider} />
          <Section style={footer}>
            <Text style={footerText}>
              Cet email est envoyé par{' '}
              <a href="https://confidance-defi.com" style={link}>
                Confidance-defi
              </a>
              , votre plateforme de paiements programmés décentralisés.
            </Text>
            <Text style={footerText}>
              Des questions ? Contactez-nous sur{' '}
              <a href="mailto:contact@confidance-defi.com" style={link}>
                contact@confidance-defi.com
              </a>
            </Text>
            <Text style={copyrightText}>
              © 2025 Confidance-defi. Tous droits réservés.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default TransactionReceiptEmail;

// ============================================================
// STYLES
// ============================================================

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const logoSection = {
  padding: '32px 40px',
  textAlign: 'center' as const,
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
};

const logo = {
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: '700',
  margin: '0',
  padding: '0',
};

const logoIcon = {
  width: '40px',
  height: '40px',
  backgroundColor: '#667eea',
  borderRadius: '12px',
  textAlign: 'center' as const,
};

const logoIconText = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700',
  textAlign: 'center' as const,
  lineHeight: '40px',
  padding: '0',
  margin: '0',
};

const logoText = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: '700',
} as React.CSSProperties;

const tagline = {
  color: '#e0e7ff',
  fontSize: '14px',
  margin: '8px 0 0 0',
};

const greetingSection = {
  padding: '32px 40px 0',
};

const greeting = {
  color: '#1f2937',
  fontSize: '24px',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const introText = {
  color: '#6b7280',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
};

const cardSection = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  margin: '24px 40px',
  padding: '32px',
};

const statusBadge = (color: string) => ({
  backgroundColor: `${color}20`,
  borderRadius: '20px',
  padding: '8px 16px',
  display: 'inline-block',
  marginBottom: '24px',
});

const statusText = {
  color: '#1f2937',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0',
  textAlign: 'center' as const,
};

const amountSection = {
  textAlign: 'center' as const,
  marginBottom: '24px',
};

const amountLabel = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0 0 8px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const amountValue = {
  color: '#1f2937',
  fontSize: '36px',
  fontWeight: '700',
  margin: '0',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const divider = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
};

const detailsSection = {
  marginBottom: '24px',
};

const detailsTable = {
  width: '100%',
};

const labelCell = {
  color: '#6b7280',
  fontSize: '14px',
  paddingBottom: '12px',
  width: '40%',
};

const valueCell = {
  color: '#1f2937',
  fontSize: '14px',
  fontWeight: '500',
  paddingBottom: '12px',
  fontFamily: 'monospace',
};

const buttonSection = {
  textAlign: 'center' as const,
};

const primaryButton = {
  backgroundColor: '#667eea',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  margin: '8px 4px',
};

const secondaryButton = {
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
  color: '#374151',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  margin: '8px 4px',
};

const infoSection = {
  backgroundColor: '#eff6ff',
  borderLeft: '4px solid #3b82f6',
  borderRadius: '8px',
  padding: '16px 24px',
  margin: '24px 40px',
};

const infoTitle = {
  color: '#1e40af',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 8px 0',
};

const infoText = {
  color: '#1e3a8a',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const securitySection = {
  margin: '24px 40px',
};

const securityText = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0',
};

const footerDivider = {
  borderColor: '#e5e7eb',
  margin: '32px 40px',
};

const footer = {
  padding: '0 40px',
};

const footerText = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0 0 8px 0',
  textAlign: 'center' as const,
};

const link = {
  color: '#667eea',
  textDecoration: 'underline',
};

const copyrightText = {
  color: '#9ca3af',
  fontSize: '11px',
  margin: '16px 0 0 0',
  textAlign: 'center' as const,
};

