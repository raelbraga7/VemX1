import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { ativarAssinatura } from '@/lib/assinaturaService';

interface AssinaturaButtonProps {
  plano: 'basico' | 'premium';
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost' | 'link';
}

export function AssinaturaButton({ plano, variant = 'default' }: AssinaturaButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();

  const handleAssinar = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    try {
      setIsLoading(true);
      
      const result = await ativarAssinatura(user.uid, plano);
      
      if (result.success) {
        toast({
          title: 'Assinatura ativada',
          description: `Sua assinatura do plano ${plano} foi ativada com sucesso!`,
          variant: 'default',
        });
        
        router.push('/dashboard');
      } else {
        throw new Error('Erro ao ativar assinatura');
      }
    } catch (error) {
      console.error('Erro na assinatura:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao processar a assinatura',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleAssinar} 
      disabled={isLoading}
      variant={variant}
      className="w-full"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processando...
        </>
      ) : (
        <>Assinar</>
      )}
    </Button>
  );
} 