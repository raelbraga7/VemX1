import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Inicializar o Firebase Admin SDK (apenas uma vez)
if (!getApps().length) {
  try {
    console.log('🔄 Inicializando Firebase Admin...');
    
    // Priorizar a variável Base64
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      try {
        console.log('🔑 Usando credenciais Base64');
        const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
        const jsonString = Buffer.from(base64, "base64").toString("utf8");
        const serviceAccount = JSON.parse(jsonString);
        
        initializeApp({
          credential: cert(serviceAccount)
        });
        console.log('✅ Firebase Admin inicializado com sucesso usando Base64');
      } catch (error) {
        console.error('❌ Erro ao usar credenciais Base64:', error);
      }
    } else {
      console.warn('⚠️ Variável FIREBASE_SERVICE_ACCOUNT_BASE64 não encontrada, tentando método antigo');
      
      // Verificar variáveis em múltiplos locais (código de fallback)
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 
                        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
                        
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || 
                          process.env.FIREBASE_CLIENT_EMAIL;
                          
      let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || 
                      process.env.FIREBASE_PRIVATE_KEY;
      
      // Verificar se a chave começa e termina com aspas
      if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
        console.log('🔑 Chave privada estava envolvida em aspas - aspas removidas');
      }
      
      // Preparar a chave privada (substituir \n por quebras de linha reais)
      const formattedPrivateKey = privateKey ? privateKey.replace(/\\n/g, '\n') : undefined;
      
      if (!projectId) {
        throw new Error('FIREBASE_ADMIN_PROJECT_ID ou NEXT_PUBLIC_FIREBASE_PROJECT_ID está faltando');
      }
      
      console.log(`📊 Detalhes de configuração fallback: 
        - ProjectID: ${projectId}
        - ClientEmail: ${clientEmail ? 'Configurado' : 'Não configurado'} 
        - PrivateKey: ${privateKey ? 'Configurada' : 'Não configurada'} 
      `);
      
      if (clientEmail && formattedPrivateKey) {
        try {
          initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey: formattedPrivateKey,
            })
          });
          console.log('✅ Firebase Admin inicializado com método fallback');
        } catch (error) {
          console.error('❌ Erro ao inicializar com fallback:', error);
          throw error;
        }
      } else {
        throw new Error('Credenciais incompletas e variável FIREBASE_SERVICE_ACCOUNT_BASE64 não encontrada');
      }
    }
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase Admin:', error);
  }
}

// Exportações
export const db = getFirestore();
export { FieldValue }; 