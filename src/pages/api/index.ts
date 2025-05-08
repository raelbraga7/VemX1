import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ 
    name: 'VEMX1 API',
    status: 'online',
    timestamp: new Date().toISOString() 
  });
} 