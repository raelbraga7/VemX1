import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// Inicializar o Firebase Admin SDK (apenas uma vez)
if (!getApps().length) {
  try {
    // Log das variáveis disponíveis (sem mostrar valores sensíveis)
    console.log('Variáveis do Firebase disponíveis:',
      `NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✓' : '✗'}`,
      `FIREBASE_CLIENT_EMAIL/ADMIN: ${(process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL) ? '✓' : '✗'}`,
      `FIREBASE_PRIVATE_KEY/ADMIN: ${(process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY) ? '✓' : '✗'}`
    );
    
    // Verificar variáveis em múltiplos locais
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 
                      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
                      
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || 
                        process.env.FIREBASE_CLIENT_EMAIL;
                        
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || 
                    process.env.FIREBASE_PRIVATE_KEY || 
                    process.env.IREBASE_PRIVATE_KEY; // Verificar também se houve erro de digitação
    
    // Verificar se a chave começa e termina com aspas (problema comum em variáveis de ambiente)
    if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
      console.log('🔑 Chave privada estava envolvida em aspas - aspas removidas');
    }
    
    // Preparar a chave privada (substituir \n por quebras de linha reais)
    const formattedPrivateKey = privateKey ? privateKey.replace(/\\n/g, '\n') : undefined;
    
    if (!projectId) {
      throw new Error('FIREBASE_ADMIN_PROJECT_ID ou NEXT_PUBLIC_FIREBASE_PROJECT_ID está faltando');
    }
    
    console.log(`📊 Detalhes de configuração: 
      - ProjectID: ${projectId}
      - ClientEmail: ${clientEmail ? 'Configurado' : 'Não configurado'} 
      - PrivateKey: ${privateKey ? 'Configurada' : 'Não configurada'} (${privateKey?.length || 0} caracteres)
      - Chave formatada: ${formattedPrivateKey ? 'Sim' : 'Não'} (${formattedPrivateKey?.length || 0} caracteres)
    `);
    
    // Configura as credenciais do Firebase Admin
    if (clientEmail && formattedPrivateKey) {
      try {
        // Método completo com credenciais
        const firebaseAdminConfig: FirebaseAdminConfig = {
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        };
        
        // Log para inspeção da estrutura (NÃO do conteúdo)
        console.log('🔒 Estrutura da configuração:', 
          Object.keys(firebaseAdminConfig)
            .map(k => `${k}: ${k === 'privateKey' ? '(segredo)' : firebaseAdminConfig[k as keyof FirebaseAdminConfig]}`)
        );
        
        // Inicializa o app com credenciais completas
        initializeApp({
          credential: cert(firebaseAdminConfig),
        });
        console.log('🔥 Firebase Admin inicializado com credenciais completas');
      } catch (certError) {
        console.error('❌ Erro ao certificar credenciais:', certError);
        
        // Alternativa: Tentar usar o service account diretamente
        try {
          console.log('⚠️ Tentando método alternativo de inicialização...');
          
          // Criar objeto por conta própria
          const serviceAccount: ServiceAccount = {
            type: 'service_account',
            project_id: projectId,
            private_key_id: "key_id_placeholder",
            private_key: formattedPrivateKey,
            client_email: clientEmail,
            client_id: "client_id_placeholder",
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`
          };
          
          initializeApp({
            credential: cert(serviceAccount as any), // 'any' necessário devido a limitações do tipo
          });
          console.log('🔥 Firebase Admin inicializado com objeto service account completo');
        } catch (saError) {
          console.error('❌ Erro ao inicializar com service account:', saError);
          throw saError;
        }
      }
    } else {
      console.warn('⚠️ Credenciais incompletas. Tentando inicialização alternativa.');
      
      // Tentar inicializar com projeto apenas
      try {
        initializeApp({
          projectId,
        });
        console.log('🔥 Firebase Admin inicializado com apenas projectId');
      } catch (altError) {
        console.error('❌ Erro na inicialização alternativa:', altError);
        
        // Última tentativa - inicialização sem parâmetros
        try {
          initializeApp();
          console.log('🔥 Firebase Admin inicializado sem parâmetros (pode não funcionar corretamente)');
        } catch (fallbackError) {
          console.error('❌ Erro na inicialização de fallback:', fallbackError);
        }
      }
    }
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase Admin:', error);
  }
}

// Log final
try {
  console.log('Firebase Admin inicializado com sucesso');
} catch (error) {
  console.error('Erro após inicialização:', error);
}

// Exporta a instância do Firestore
export const db = getFirestore();

// Exporta as funções do Firestore que serão usadas nos webhooks
export { FieldValue } from 'firebase-admin/firestore'; 