// src/lib/supabase/keeper-test.ts
import { supabase } from './client';

export async function testKeeperConnection() {
  try {
    console.log('🔍 Test de connexion Keeper -> Supabase...');
    
    // 1. Vérifier la connexion
    const { data: connectionTest, error: connectionError } = await supabase
      .from('scheduled_payments')
      .select('count')
      .limit(1);
    
    if (connectionError) {
      console.error('❌ Erreur connexion Supabase:', connectionError);
      return false;
    }
    
    console.log('✅ Connexion Supabase OK');
    
    // 2. Vérifier les paiements pending
    const { data: pendingPayments, error: pendingError } = await supabase
      .from('scheduled_payments')
      .select('*')
      .eq('status', 'pending')
      .order('release_time', { ascending: true });
    
    if (pendingError) {
      console.error('❌ Erreur récupération paiements:', pendingError);
      return false;
    }
    
    console.log(`📊 Paiements pending trouvés: ${pendingPayments?.length || 0}`);
    
    // 3. Vérifier les paiements prêts à être exécutés
    const now = Math.floor(Date.now() / 1000);
    const { data: readyPayments, error: readyError } = await supabase
      .from('scheduled_payments')
      .select('*')
      .eq('status', 'pending')
      .lte('release_time', now);
    
    if (readyError) {
      console.error('❌ Erreur récupération paiements prêts:', readyError);
      return false;
    }
    
    console.log(`⏰ Paiements prêts à exécuter: ${readyPayments?.length || 0}`);
    
    if (readyPayments && readyPayments.length > 0) {
      console.log('🎯 Paiements qui devraient être exécutés:');
      readyPayments.forEach((payment, index) => {
        const releaseDate = new Date(payment.release_time * 1000);
        const delayMinutes = Math.floor((now - payment.release_time) / 60);
        console.log(`  ${index + 1}. ID: ${payment.id}`);
        console.log(`     Contrat: ${payment.contract_address}`);
        console.log(`     Date prévue: ${releaseDate.toLocaleString()}`);
        console.log(`     Retard: ${delayMinutes} minutes`);
        console.log(`     Status: ${payment.status}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur test keeper:', error);
    return false;
  }
}

// Fonction pour simuler l'exécution d'un paiement
export async function simulatePaymentExecution(paymentId: string) {
  try {
    console.log(`🔄 Simulation exécution paiement ${paymentId}...`);
    
    const { data, error } = await supabase
      .from('scheduled_payments')
      .update({
        status: 'executed',
        executed_at: new Date().toISOString(),
        execution_tx_hash: '0x' + Math.random().toString(16).substr(2, 64), // Simulation
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .select();
    
    if (error) {
      console.error('❌ Erreur simulation:', error);
      return false;
    }
    
    console.log('✅ Simulation réussie:', data);
    return true;
  } catch (error) {
    console.error('❌ Erreur simulation:', error);
    return false;
  }
}

