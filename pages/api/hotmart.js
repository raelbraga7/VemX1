import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

// Firebase config (use suas variáveis de ambiente)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  // ... outros campos se necessário
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const db = getFirestore();

export default async function handler(req, res) {
  console.log('[Hotmart Webhook] Requisição recebida');
  
  const hottokHeader = req.headers['hottok'];
  const expectedHottok = process.env.HOTMART_HOTTOK;

  // ✅ Verificação de segurança
  if (hottokHeader !== expectedHottok) {
    console.log('[Hotmart Webhook] Acesso não autorizado - token inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    console.log('[Hotmart Webhook] Método não permitido:', req.method);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const event = req.body;
  console.log('🔥 Webhook recebido:', JSON.stringify(event, null, 2));

  // 💡 Processar evento com base no status
  try {
    const email = event?.buyer?.email;
    if (!email) {
      console.log('[Hotmart Webhook] Email do comprador não encontrado');
      return res.status(400).json({ error: 'Email do comprador não encontrado.' });
    }

    const status = event?.purchase?.status;
    console.log(`[Hotmart Webhook] Status da compra: ${status}`);

    // Buscar o usuário pelo email
    const usuariosRef = collection(db, 'usuarios');
    const q = query(usuariosRef, where('email', '==', email));
    const usuariosSnapshot = await getDocs(q);
    
    if (usuariosSnapshot.empty) {
      console.log(`[Hotmart Webhook] Usuário com email ${email} não encontrado no Firestore`);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const usuarioDoc = usuariosSnapshot.docs[0];
    const usuarioId = usuarioDoc.id;
    const usuarioRef = doc(db, 'usuarios', usuarioId);

    // Definir o plano com base no produto
    const produtoNome = event?.product?.name?.toLowerCase() || '';
    let plano = 'basico';  
    if (produtoNome.includes('premium')) {
      plano = 'premium';
    }

    // Registrar o webhook
    const webhookRef = doc(collection(db, 'hotmart_webhooks'));
    await setDoc(webhookRef, {
      id: webhookRef.id,
      data: event,
      email: email,
      usuarioId: usuarioId,
      status: status,
      plano: plano,
      timestamp: new Date(),
      processado: false
    });

    // Atualizar status baseado no evento Hotmart
    if (status === 'APPROVED' || status === 'COMPLETE') {
      // Ativar assinatura
      await updateDoc(usuarioRef, {
        statusAssinatura: 'ativa',
        plano: plano,
        dataAssinatura: new Date(),
        dataUltimaAtualizacao: new Date(),
        provider: 'hotmart',
        transacaoId: event?.purchase?.transaction || null,
        produtoId: event?.product?.id || null
      });
      console.log(`[Hotmart Webhook] Assinatura ativada para o usuário ${usuarioId}`);
    } 
    else if (status === 'CANCELED' || status === 'REFUNDED' || status === 'CHARGEBACK') {
      // Cancelar assinatura
      await updateDoc(usuarioRef, {
        statusAssinatura: 'cancelada',
        dataUltimaAtualizacao: new Date()
      });
      console.log(`[Hotmart Webhook] Assinatura cancelada para o usuário ${usuarioId}`);
    }
    else if (status === 'DELAYED') {
      // Marcar como inadimplente
      await updateDoc(usuarioRef, {
        statusAssinatura: 'inadimplente',
        dataUltimaAtualizacao: new Date()
      });
      console.log(`[Hotmart Webhook] Assinatura marcada como inadimplente para o usuário ${usuarioId}`);
    }

    // Marcar webhook como processado
    await updateDoc(webhookRef, {
      processado: true
    });

    return res.status(200).json({ 
      message: 'Webhook processado com sucesso.',
      usuarioId,
      plano,
      status
    });
  } catch (error) {
    console.error('[Hotmart Webhook] Erro ao processar webhook:', error);
    return res.status(500).json({ error: 'Erro interno ao processar webhook.' });
  }
} 