import { collection, addDoc, query, where, getDocs, updateDoc, doc, onSnapshot, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from './config';
import { setDoc, deleteDoc } from 'firebase/firestore';
import { Notification } from '@/types/notification';
import { PeladaData, Jogador } from '@/types/pelada';
import { getUserById } from './userService';

export interface NotificationObserver {
  next: (notifications: Notification[]) => void;
  error: (error: Error) => void;
}

export const createNotification = async (notification: Notification): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'notifications'), notification);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    throw error;
  }
};

export const getNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Notification));
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    throw error;
  }
};

export const subscribeToNotifications = (userId: string, observer: NotificationObserver): () => void => {
  const notificationsRef = collection(db, 'notifications');
  const q = query(notificationsRef, where('userId', '==', userId));

  return onSnapshot(q, 
    (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      observer.next(notifications);
    },
    (error) => {
      console.error('Erro ao observar notificações:', error);
      observer.error(new Error('Erro ao observar notificações'));
    }
  );
};

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, { read: true });
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(q);
    
    await Promise.all(
      snapshot.docs.map(doc => 
        updateDoc(doc.ref, {
          read: true,
          readAt: new Date().toISOString()
        })
      )
    );
  } catch (error) {
    console.error('Erro ao marcar todas notificações como lidas:', error);
    throw error;
  }
};

export const createPeladaNotification = async (
  userId: string,
  peladaId: string,
  title: string,
  message: string
): Promise<string> => {
  const notification: Notification = {
    userId,
    peladaId,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false
  };

  const docRef = await addDoc(collection(db, 'notifications'), notification);
  return docRef.id;
};

export const createPeladaInvite = async (
  peladaId: string,
  userId: string,
  title: string,
  message: string
) => {
  try {
    const notificationData: Notification = {
      userId,
      peladaId,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar notificação de convite:', error);
    throw error;
  }
};

export const respondToPeladaInvite = async (
  notificationId: string,
  response: 'confirm' | 'reject'
) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      [`actions.${response}`]: true,
      read: true
    });
  } catch (error) {
    console.error('Erro ao responder ao convite:', error);
    throw error;
  }
};

export const createPeladaConfirmationRequest = async (
  userId: string,
  peladaId: string,
  peladaNome: string
): Promise<string> => {
  const notification: Notification = {
    userId,
    peladaId,
    title: 'Confirmação de Presença',
    message: `Você confirma presença na pelada ${peladaNome}?`,
    timestamp: new Date().toISOString(),
    read: false,
    actions: {
      confirm: false,
      reject: false
    }
  };

  const docRef = await addDoc(collection(db, 'notifications'), notification);
  return docRef.id;
};

export const respondToConfirmation = async (
  notificationId: string,
  response: 'confirm' | 'reject',
  userId: string,
  peladaId: string
) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    const peladaRef = doc(db, 'peladas', peladaId);
    
    // Atualiza a notificação com a resposta
    await updateDoc(notificationRef, {
      read: true,
      [`actions.${response}`]: true
    });

    // Se confirmou, atualiza a lista de confirmados e players na pelada
    if (response === 'confirm') {
      const peladaDoc = await getDoc(peladaRef);
      if (peladaDoc.exists()) {
        const peladaData = peladaDoc.data() as PeladaData;
        const userInfo = await getUserById(userId);
        
        // Adiciona à lista de players se ainda não estiver
        const novosPlayers = peladaData.players.includes(userId) 
          ? peladaData.players 
          : [...peladaData.players, userId];

        const novoJogador: Jogador = {
          uid: userId,
          nome: userInfo?.nome || 'Usuário',
          email: userInfo?.email || '',
          dataConfirmacao: new Date().toISOString()
        };

        if (userInfo?.photoURL) {
          novoJogador.photoURL = userInfo.photoURL;
        }

        await updateDoc(peladaRef, {
          players: novosPlayers,
          confirmados: arrayUnion(novoJogador)
        });
      }
    }
  } catch (error) {
    console.error('Erro ao responder à confirmação:', error);
    throw error;
  }
};

export const acceptPeladaInvite = async (notificationId: string, userId: string) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    const notificationDoc = await getDoc(notificationRef);
    
    if (!notificationDoc.exists()) {
      throw new Error('Notificação não encontrada');
    }

    const notificationData = notificationDoc.data();
    const peladaId = notificationData.peladaId;

    // Atualiza a notificação
    await updateDoc(notificationRef, {
      read: true,
      [`actions.confirm`]: true
    });

    // Adiciona o jogador à pelada e à lista de confirmados
    const peladaRef = doc(db, 'peladas', peladaId);
    const peladaDoc = await getDoc(peladaRef);
    
    if (peladaDoc.exists()) {
      const peladaData = peladaDoc.data();
      
      // Garante que o jogador está na lista de players
      const novosPlayers = peladaData.players.includes(userId) 
        ? peladaData.players 
        : [...peladaData.players, userId];

      // CORREÇÃO: Não verificamos mais se o limite de jogadores confirmados foi atingido
      // Os valores de quantidadeTimes e jogadoresPorTime são apenas para exibição visual
      // e gerenciamento dos times durante a partida
      
      // Adiciona o jogador à lista de confirmados se ainda não estiver
      const userInfo = await getUserById(userId);
      const novoJogador: Jogador = {
        uid: userId,
        nome: userInfo?.nome || 'Usuário',
        email: userInfo?.email || '',
        dataConfirmacao: new Date().toISOString()
      };

      if (userInfo?.photoURL) {
        novoJogador.photoURL = userInfo.photoURL;
      }

      // Verifica se o jogador já está confirmado 
      const confirmadosAtualizados = peladaData.confirmados || [];
      if (!confirmadosAtualizados.some((c: { uid: string }) => c.uid === userId)) {
        confirmadosAtualizados.push(novoJogador);
      }

      // Atualiza a pelada com as novas informações
      await updateDoc(peladaRef, {
        players: novosPlayers,
        confirmados: confirmadosAtualizados
      });
    }

    return true;
  } catch (error) {
    console.error('Erro ao aceitar convite:', error);
    throw error;
  }
};

export const sendConfirmationRequestToAllPlayers = async (peladaId: string, peladaData: PeladaData) => {
  try {
    // Obter os jogadores que já confirmaram presença
    const jogadoresConfirmados = new Set(peladaData.confirmados?.map(j => j.uid) || []);
    
    // Pega todos os jogadores do ranking que ainda não confirmaram presença
    const jogadoresParaConvidar = Object.keys(peladaData.ranking || {})
      .filter(id => !jogadoresConfirmados.has(id));
    
    if (jogadoresParaConvidar.length === 0) {
      console.log('Não há jogadores para convidar - todos já confirmaram presença ou foram convidados');
      return;
    }

    console.log(`Enviando notificações para ${jogadoresParaConvidar.length} jogadores não confirmados:`, jogadoresParaConvidar);

    // Cria notificações para cada jogador
    const notificacoes = jogadoresParaConvidar.map(jogadorId => ({
      userId: jogadorId,
      title: 'Confirmação de Presença',
      message: `Confirme sua presença na pelada "${peladaData.nome || 'Nova Pelada'}"`,
      peladaId: peladaId,
      read: false,
      type: 'CONFIRMACAO' as const,
      respondido: false,
      timestamp: new Date().toISOString(),
      actions: {
        confirm: true,
        reject: true
      },
      // Adicionando link direto para a página de confirmação com parâmetro para confirmar automaticamente
      actionLink: `/pelada/${peladaId}/confirmar?status=confirm`
    }));

    // Envia todas as notificações
    await Promise.all(notificacoes.map(notification => createNotification(notification)));

    console.log('Notificações enviadas com sucesso para:', jogadoresParaConvidar);
    return jogadoresParaConvidar.length; // Retorna o número de jogadores notificados
  } catch (error) {
    console.error('Erro ao enviar notificações:', error);
    throw error;
  }
};

interface FCMToken {
  token: string;
  createdAt: Date;
  platform: string;
  lastActive: Date;
}

/**
 * Salva ou atualiza o token FCM do usuário no Firestore
 * @param userId ID do usuário
 * @param fcmToken Token FCM gerado
 * @returns Promise que resolve quando o token é salvo
 */
export const saveUserFCMToken = async (userId: string, fcmToken: string): Promise<void> => {
  try {
    // Cria uma referência para o documento do token
    const tokenRef = doc(db, 'users', userId, 'fcm_tokens', fcmToken);

    // Dados do token
    const tokenData: FCMToken = {
      token: fcmToken,
      createdAt: new Date(),
      platform: 'web',
      lastActive: new Date()
    };

    // Salva o token no Firestore
    await setDoc(tokenRef, tokenData);
    console.log('Token FCM salvo com sucesso para o usuário:', userId);
  } catch (error) {
    console.error('Erro ao salvar token FCM:', error);
    throw error;
  }
};

/**
 * Remove um token FCM do usuário
 * @param userId ID do usuário
 * @param fcmToken Token FCM a ser removido
 */
export const removeUserFCMToken = async (userId: string, fcmToken: string): Promise<void> => {
  try {
    const tokenRef = doc(db, 'users', userId, 'fcm_tokens', fcmToken);
    await deleteDoc(tokenRef);
    console.log('Token FCM removido com sucesso');
  } catch (error) {
    console.error('Erro ao remover token FCM:', error);
    throw error;
  }
};

export const deleteNotification = async (notificationId: string) => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    console.error('Erro ao deletar notificação:', error);
    throw error;
  }
};

export const getUserNotifications = async (userId: string): Promise<Array<Notification & { id: string }>> => {
  try {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Array<Notification & { id: string }>;
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    throw error;
  }
};