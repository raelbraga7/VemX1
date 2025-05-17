import Link from 'next/link';

interface Props {
  nomeTime: string;
  jogadorStats: {
    vitorias: number;
    gols: number;
    assistencias: number;
    pontos: number;
    jogos: number;
  };
  isCapitao: boolean;
}

export default function MensagemCampeao({ nomeTime, jogadorStats, isCapitao }: Props) {
  const texto = encodeURIComponent(`Olá! Sou capitão do time ${nomeTime} que foi campeão da temporada e gostaria de solicitar o troféu. 🏆`);
  const linkWhatsApp = `https://wa.me/5522998345691?text=${texto}`;

  return (
    <div>
      <h2>Parabéns! 🏆</h2>
      <p>O time <strong>{nomeTime}</strong> é o campeão da temporada!</p>
      
      <p>Seus números na temporada:</p>
      <ul>
        <li>• {jogadorStats.vitorias} vitórias</li>
        <li>• {jogadorStats.gols} gols</li>
        <li>• {jogadorStats.assistencias} assistências</li>
      </ul>
      
      <p>Continue assim, você é parte de um time vencedor! 🌟</p>
      
      {isCapitao ? (
        <>
          <p>🎁 Como capitão do time, você pode solicitar o troféu ou premiação!</p>
          <p>Fale agora com nosso suporte no WhatsApp clicando no botão abaixo e solicite a recompensa exclusiva do seu time:</p>
          <Link href={linkWhatsApp} target="_blank">
            <span style={{ color: 'blue', textDecoration: 'underline' }}>
              👉 Pedir troféu no WhatsApp
            </span>
          </Link>
        </>
      ) : (
        <p>🎁 O capitão do seu time poderá solicitar o troféu ou premiação para a equipe!</p>
      )}
    </div>
  );
} 