'use client';

import { useState, useEffect } from 'react';
import { Button, Card, CardContent, Typography, Chip, Box, CircularProgress } from '@mui/material';
import { InfoAssinatura, obterInfoAssinatura } from '@/firebase/assinaturaService';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'react-hot-toast';

export default function AssinaturaInfo() {
  const { user } = useUser();
  const [assinatura, setAssinatura] = useState<InfoAssinatura | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const buscarAssinatura = async () => {
      if (!user) return;
      
      try {
        const info = await obterInfoAssinatura(user.uid);
        setAssinatura(info);
      } catch (error) {
        console.error('Erro ao buscar informações de assinatura:', error);
      } finally {
        setLoading(false);
      }
    };

    buscarAssinatura();
  }, [user]);

  const handleCancelarAssinatura = async () => {
    if (!user) return;
    
    if (!confirm('Tem certeza que deseja cancelar sua assinatura?')) {
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (response.ok) {
        toast.success('Assinatura cancelada com sucesso!');
        // Atualizar o estado local
        if (assinatura) {
          setAssinatura({
            ...assinatura,
            statusAssinatura: 'cancelada',
            dataUltimaAtualizacao: new Date()
          });
        }
      } else {
        throw new Error('Erro ao cancelar assinatura');
      }
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      toast.error('Erro ao cancelar assinatura. Tente novamente.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativa':
        return 'success';
      case 'inadimplente':
        return 'error';
      case 'cancelada':
        return 'default';
      case 'teste':
        return 'info';
      default:
        return 'warning';
    }
  };

  const formatarData = (data: Date | null) => {
    if (!data) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(data);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );
  }

  // Se não tem assinatura, mostrar botão para assinar
  if (!assinatura || !assinatura.plano) {
    return (
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Assinatura
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Você ainda não possui uma assinatura ativa.
          </Typography>
          <Button 
            variant="contained" 
            color="primary"
            href="/assinatura"
            sx={{ mt: 2 }}
          >
            Assinar Agora
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ mb: 4 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Assinatura
          </Typography>
          <Chip 
            label={assinatura.statusAssinatura}
            color={getStatusColor(assinatura.statusAssinatura) as "success" | "error" | "default" | "info" | "warning" | "primary" | "secondary"}
            size="small"
          />
        </Box>
        
        <Box mb={3}>
          <Typography variant="body2" color="text.secondary">
            Plano
          </Typography>
          <Typography variant="body1" fontWeight="medium">
            {assinatura.plano === 'basico' ? 'Plano Básico - R$ 149,99/mês' : 'Plano Premium - R$ 259,99/mês'}
          </Typography>
        </Box>
        
        <Box mb={3}>
          <Typography variant="body2" color="text.secondary">
            Data de adesão
          </Typography>
          <Typography variant="body1">
            {formatarData(assinatura.dataAssinatura)}
          </Typography>
        </Box>
        
        <Box mb={3}>
          <Typography variant="body2" color="text.secondary">
            Última atualização
          </Typography>
          <Typography variant="body1">
            {formatarData(assinatura.dataUltimaAtualizacao)}
          </Typography>
        </Box>
        
        {assinatura.statusAssinatura === 'ativa' && (
          <Button
            variant="outlined"
            color="error"
            fullWidth
            onClick={handleCancelarAssinatura}
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={24} /> : 'Cancelar Assinatura'}
          </Button>
        )}
        
        {assinatura.statusAssinatura !== 'ativa' && (
          <Button
            variant="contained"
            color="primary"
            fullWidth
            href="/assinatura"
          >
            Assinar Novamente
          </Button>
        )}
      </CardContent>
    </Card>
  );
} 