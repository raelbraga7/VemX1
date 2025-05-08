import type { NextApiRequest, NextApiResponse } from 'next';

// Desabilitar o parser de corpo padrão
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('======= WEBHOOK MERCADO PAGO =======');
  console.log('Método:', req.method);
  
  // Para GET (testes)
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'success',
      message: 'Webhook do Mercado Pago está operacional',
      timestamp: new Date().toISOString()
    });
  }
  
  // Para OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-signature');
    return res.status(200).end();
  }
  
  // Aceitar somente POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'GET', 'OPTIONS']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  try {
    // Capturar o corpo bruto
    const rawBody = await new Promise<string>((resolve, reject) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
      });
      req.on('end', () => {
        resolve(data);
      });
      req.on('error', err => {
        reject(err);
      });
    });
    
    console.log('PAYLOAD RECEBIDO:', rawBody);
    
    // Parse do JSON
    let data;
    try {
      data = JSON.parse(rawBody);
      console.log('PAYLOAD PROCESSADO:', JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.error('ERRO AO PROCESSAR JSON:', parseError);
      return res.status(200).json({ success: true });
    }
    
    console.log('TIPO:', data.type || data.action);
    console.log('ID:', data.data?.id || data.id);
    
    // Sempre retornar 200 OK
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('ERRO NO PROCESSAMENTO:', error);
    return res.status(200).json({ success: true });
  }
} 