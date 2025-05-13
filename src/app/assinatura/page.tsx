'use client';

import { PLANOS } from '@/lib/planos';
import { HotmartButton } from '@/components/HotmartButton';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Box
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';

export default function AssinaturaPage() {
  const featuresPremium = [
    'Jogadores ILIMITADOS',
    'Peladas ILIMITADAS',
    'Estatísticas avançadas',
    'Suporte prioritário',
    'Cancele quando quiser'
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Typography variant="h4" component="h1" align="center" gutterBottom>
            Assine o VemX1
          </Typography>
          <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 6 }}>
            Desfrute de todas as funcionalidades para gerenciar suas peladas.
          </Typography>
          
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
              PLANO VEMX1
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
              <div className="w-full">
                <HotmartButton plano="premium" />
              </div>
            </CardContent>
          </Card>

          <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 6 }}>
            * Os preços são cobrados mensalmente. Cancele a qualquer momento.
          </Typography>
        </div>
      </div>
    </div>
  );
} 