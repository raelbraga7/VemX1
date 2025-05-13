import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { PLANOS } from '@/lib/planos';
import { useUser } from '@/contexts/UserContext';

interface HotmartButtonProps {
  plano: 'premium';
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost' | 'link';
}

export function HotmartButton({ plano, variant = 'default' }: HotmartButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  // Base URL para checkout da Hotmart
  const HOTMART_BASE_URL = 'https://pay.hotmart.com/M99700196W';

  const handleCheckout = async () => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado para assinar um plano',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Construir URL de checkout com parâmetros
      const params = new URLSearchParams({
        off: 'r5di19vt', // Código de oferta
        ref: user.uid,    // Referência do usuário (usado nos webhooks)
        email: user.email || '',  // Pré-preencher o email
      });
      
      // Redirecionar para a página de checkout do plano na Hotmart
      window.location.href = `${HOTMART_BASE_URL}?${params.toString()}`;

      // Em um sistema real, registrar que o usuário iniciou o processo
      await fetch('/api/pagamento/registrar-tentativa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          plano,
          email: user.email,
          timestamp: new Date().toISOString()
        }),
      }).catch(err => console.error('Erro ao registrar tentativa:', err));
      
    } catch (error) {
      console.error('Erro no checkout:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao processar o pagamento',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Obter informações do plano
  const planoInfo = PLANOS.PREMIUM;

  return (
    <Button 
      onClick={handleCheckout} 
      disabled={isLoading || !user}
      variant={variant}
      className="w-full"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processando...
        </>
      ) : (
        <>Assinar R$ {planoInfo.preco}/mês</>
      )}
    </Button>
  );
} 