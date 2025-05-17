import Link from 'next/link';

type Props = {
  nomeTime: string;
};

export default function MensagemCampeao({ nomeTime }: Props) {
  const texto = encodeURIComponent(`Olá! O time ${nomeTime} foi campeão da temporada e gostaria de solicitar o troféu. 🏆`);
  const linkWhatsApp = `https://wa.me/5522998345691?text=${texto}`;

  return (
    <div>
      <h2>Parabéns! 🏆</h2>
      <p>O time <strong>{nomeTime}</strong> é o campeão da temporada!</p>
      <p>Entre em contato com o suporte para receber seu troféu ou premiação.</p>
      <Link href={linkWhatsApp} target="_blank">
        <span style={{ color: 'blue', textDecoration: 'underline' }}>
          👉 Pedir troféu no WhatsApp
        </span>
      </Link>
    </div>
  );
} 