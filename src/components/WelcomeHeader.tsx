'use client';

import { useUser } from '@/contexts/UserContext';
import { LogoutButton } from './LogoutButton';

export default function WelcomeHeader() {
  const { userData, loading } = useUser();

  if (loading) {
    return (
      <div className="p-4 mb-6 flex justify-between items-center">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="p-4 mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Bem-vindo!</h1>
        <LogoutButton />
      </div>
    );
  }

  return (
    <div className="p-4 mb-6 flex justify-between items-center">
      <h1 className="text-2xl font-bold text-gray-800">
        Bem-vindo, {userData.nome}!
      </h1>
      <LogoutButton />
    </div>
  );
} 