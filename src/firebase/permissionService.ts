import { db } from './config';
import { doc, getDoc } from 'firebase/firestore';

export interface PeladaPermissions {
  canView: boolean;
  isOwner: boolean;
  isPlayer: boolean;
}

export const checkPeladaPermissions = async (
  userId: string | undefined,
  peladaId: string
): Promise<PeladaPermissions> => {
  if (!userId) {
    return {
      canView: false,
      isOwner: false,
      isPlayer: false
    };
  }

  try {
    const peladaDoc = await getDoc(doc(db, 'peladas', peladaId));
    
    if (!peladaDoc.exists()) {
      return {
        canView: false,
        isOwner: false,
        isPlayer: false
      };
    }

    const peladaData = peladaDoc.data();
    const isOwner = peladaData.ownerId === userId;
    const isPlayer = peladaData.players?.includes(userId) || false;

    return {
      canView: isOwner || isPlayer,
      isOwner,
      isPlayer
    };
  } catch (error) {
    console.error('Erro ao verificar permissões:', error);
    return {
      canView: false,
      isOwner: false,
      isPlayer: false
    };
  }
};

export const usePermissionCheck = () => {
  const checkPermissions = async (userId: string | undefined, peladaId: string) => {
    return await checkPeladaPermissions(userId, peladaId);
  };

  return { checkPermissions };
}; 