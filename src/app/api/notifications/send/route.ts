import { NextResponse } from 'next/server';
import { db } from '@/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { removeUserFCMToken } from '@/firebase/notificationService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as admin from 'firebase-admin';

// Verifica se as variáveis de ambiente necessárias estão definidas
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

// Verifica se todas as variáveis necessárias estão definidas
if (!projectId || !clientEmail || !privateKey) {
  console.error('Variáveis de ambiente do Firebase Admin não estão definidas:');
  if (!projectId) console.error('- FIREBASE_ADMIN_PROJECT_ID está faltando');
  if (!clientEmail) console.error('- FIREBASE_ADMIN_CLIENT_EMAIL está faltando');
  if (!privateKey) console.error('- FIREBASE_ADMIN_PRIVATE_KEY está faltando');
}

// Inicializa o Firebase Admin se ainda não foi inicializado
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
    console.log('Firebase Admin inicializado com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin:', error);
  }
}

export async function POST(request: Request) {
  try {
    // Verifica se o Firebase Admin foi inicializado corretamente
    if (!admin.apps.length) {
      return NextResponse.json(
        { error: 'Firebase Admin não foi inicializado corretamente' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { userId, data, peladaId, peladaNome, dataJogo, horario, local } = body;

    if (!userId || !peladaId || !peladaNome) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos' },
        { status: 400 }
      );
    }

    // Formata a data do jogo
    const dataFormatada = dataJogo ? 
      format(new Date(dataJogo), "EEEE, dd 'de' MMMM", { locale: ptBR }) : '';
    
    // Monta o título e mensagem
    const notificationTitle = `🎮 ${peladaNome}`;
    const notificationBody = `${dataFormatada}${horario ? ` às ${horario}` : ''}${local ? `\nLocal: ${local}` : ''}\n\nVocê confirma presença?`;

    // Busca os tokens FCM do usuário
    const tokensSnapshot = await getDocs(
      collection(db, 'users', userId, 'fcm_tokens')
    );

    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum token FCM encontrado para o usuário' },
        { status: 404 }
      );
    }

    // Configura a mensagem de notificação
    const notificationMessage = {
      notification: {
        title: notificationTitle,
        body: notificationBody
      },
      data: {
        ...data,
        peladaId: peladaId,
        peladaNome: peladaNome,
        type: 'CONFIRMACAO',
        dataJogo: dataJogo || '',
        horario: horario || '',
        local: local || ''
      },
      tokens,
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          title: notificationTitle,
          body: notificationBody,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          vibrate: [100, 50, 100],
          requireInteraction: true,
          actions: [
            {
              action: 'confirm',
              title: '✅ Confirmar'
            },
            {
              action: 'reject',
              title: '❌ Recusar'
            }
          ],
          tag: `pelada-${peladaId}-${Date.now()}`,
          renotify: false, // Evita duplicatas
          silent: false,
          timestamp: Date.now(),
          data: {
            peladaId,
            peladaNome,
            type: 'CONFIRMACAO',
            dataJogo: dataJogo || '',
            horario: horario || '',
            local: local || '',
            url: `/pelada/${peladaId}/confirmar`
          }
        },
        fcmOptions: {
          link: `/pelada/${peladaId}/confirmar`
        }
      }
    } as const;

    // Envia a notificação usando o Firebase Admin SDK
    const messaging = admin.messaging();
    // @ts-expect-error: O tipo Messaging do Firebase Admin SDK está incompleto
    const response = await messaging.sendMulticast(notificationMessage);

    // Verifica tokens inválidos e os remove
    const failedTokens: string[] = [];
    response.responses.forEach((resp: { success: boolean }, idx: number) => {
      if (!resp.success) {
        failedTokens.push(tokens[idx]);
      }
    });

    // Remove tokens inválidos
    if (failedTokens.length > 0) {
      await Promise.all(
        failedTokens.map(token =>
          removeUserFCMToken(userId, token)
        )
      );
    }

    return NextResponse.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount
    });
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar notificação' },
      { status: 500 }
    );
  }
} 