import Link from 'next/link';

type Props = {
  nomeTime: string;
};

// Componente React para exibição na UI
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

// Função para gerar texto simples para notificações
export function gerarTextoNotificacaoTimeCampeao({ nomeTime }: Props): string {
  const texto = encodeURIComponent(`Olá! O time ${nomeTime} foi campeão da temporada e gostaria de solicitar o troféu. 🏆`);
  
  return `🏅 Parabéns! 🏆

O time ${nomeTime} é o grande campeão da temporada!
Superaram todos os desafios e mostraram que têm alma de vencedor.

Entre em contato com o suporte para receber seu troféu ou premiação.

<a href="https://wa.me/5522998345691?text=${texto}" style="color:blue;text-decoration:underline;">👉 Pedir troféu no WhatsApp</a>`;
} 