import { useUser } from '@/hooks/useUser';

export default function UserProfile() {
  const { user, userData, loading } = useUser();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d4ed8]"></div>
      </div>
    );
  }

  if (!user || !userData) {
    return (
      <div className="p-4 text-center text-gray-600">
        <p>Você não está logado</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-[#1d4ed8] rounded-full flex items-center justify-center text-white text-xl font-bold">
          {userData.nome.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{userData.nome}</h2>
          <p className="text-sm text-gray-500">{userData.email}</p>
        </div>
      </div>
    </div>
  );
} 