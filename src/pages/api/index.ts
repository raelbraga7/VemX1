import { NextApiRequest, NextApiResponse } from 'next';

// Arquivo de índice para garantir que a estrutura de diretórios seja reconhecida
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).json({ message: 'API do VemX1' });
} 