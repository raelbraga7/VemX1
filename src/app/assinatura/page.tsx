'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { PLANOS } from '@/lib/mercadopago';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  Button, 
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Box,
  CircularProgress
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { toast } from 'react-hot-toast';

export default function AssinaturaPage() {
  const router = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState<string | null>(null);

  const handleAssinar = async (planoId: string) => {
    if (!user) {
      toast.error('Você precisa estar logado para assinar um plano');
      router.push('/login');
      return;
    }

    setLoading(planoId);

    try {
      const response = await fetch('/api/checkout/mercadopago', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plano: planoId,
          userId: user.uid,
          userEmail: user.email,
        }),
      });

      const data = await response.json();

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('URL de checkout não encontrada');
      }
    } catch (error) {
      console.error('Erro ao iniciar checkout:', error);
      toast.error('Erro ao processar pagamento. Tente novamente.');
    } finally {
      setLoading(null);
    }
  };

  // Definição dos recursos de cada plano
  const featuresBasico: string[] = [
    "Até 20 jogadores por pelada",
    "Até 5 peladas simultâneas",
    "Gerenciamento de times",
    "Estatísticas básicas"
  ];

  const featuresPremium: string[] = [
    "Jogadores ilimitados",
    "Peladas ilimitadas",
    "Estatísticas avançadas",
    "Exportação de relatórios",
    "Dashboard personalizado",
    "Suporte prioritário"
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-5xl mx-auto px-4">
        <Typography variant="h4" component="h1" gutterBottom align="center" className="mb-8">
          Escolha seu plano
        </Typography>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Plano Básico */}
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardHeader
              title="Plano Básico"
              titleTypographyProps={{ align: 'center', variant: 'h5' }}
              subheaderTypographyProps={{ align: 'center' }}
              sx={{ backgroundColor: '#f5f5f5', py: 3 }}
            />
            <CardContent sx={{ pt: 4 }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography component="h2" variant="h3" color="primary">
                  R$ {PLANOS.BASICO.preco}
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                  por mês
                </Typography>
              </Box>
              <List sx={{ mb: 4 }}>
                {featuresBasico.map((feature) => (
                  <ListItem key={feature} disableGutters>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={feature} />
                  </ListItem>
                ))}
              </List>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={() => handleAssinar('basico')}
                disabled={loading === 'basico'}
                sx={{ py: 1.5 }}
              >
                {loading === 'basico' ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Assinar com Mercado Pago'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Plano Premium */}
          <Card variant="outlined" sx={{ height: '100%', border: '2px solid #1976d2' }}>
            <Paper 
              elevation={0} 
              sx={{ 
                backgroundColor: '#1976d2', 
                color: 'white',
                py: 1,
                textAlign: 'center',
                fontWeight: 'bold'
              }}
            >
              MAIS POPULAR
            </Paper>
            <CardHeader
              title="Plano Premium"
              titleTypographyProps={{ align: 'center', variant: 'h5' }}
              subheaderTypographyProps={{ align: 'center' }}
              sx={{ backgroundColor: '#f5f5f5', py: 3 }}
            />
            <CardContent sx={{ pt: 4 }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography component="h2" variant="h3" color="primary">
                  R$ {PLANOS.PREMIUM.preco}
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                  por mês
                </Typography>
              </Box>
              <List sx={{ mb: 4 }}>
                {featuresPremium.map((feature) => (
                  <ListItem key={feature} disableGutters>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={feature} />
                  </ListItem>
                ))}
              </List>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={() => handleAssinar('premium')}
                disabled={loading === 'premium'}
                sx={{ py: 1.5 }}
              >
                {loading === 'premium' ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Assinar com Mercado Pago'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 6 }}>
          * Os preços são cobrados mensalmente. Cancele a qualquer momento.
        </Typography>
      </div>
    </div>
  );
} 