import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

export default function Header() {
  const { user, temAssinaturaAtiva, verificandoAssinatura } = useUser();
  const router = useRouter();

  return (
    <header className="bg-black">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold text-white">
          VemX1
        </Link>
        <div className="flex items-center gap-4">
          {user && !temAssinaturaAtiva && !verificandoAssinatura && (
            <button
              onClick={() => router.push('/dashboard?openPlanosModal=true')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Assinatura
            </button>
          )}
          <div className="flex items-center">
            {/* Outros elementos do header... */}
          </div>
        </div>
      </div>
    </header>
  );
} 