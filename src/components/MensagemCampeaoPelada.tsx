import Link from 'next/link';

type Props = {
  nomeJogador: string;
  pontos: number;
  vitorias: number;
  gols: number;
  assistencias: number;
  temporadaNome: string;
};

// Componente React para exibição na UI
export default function MensagemCampeaoPelada({ 
  nomeJogador, 
  pontos, 
  vitorias, 
  gols, 
  assistencias,
  temporadaNome 
}: Props) {
  const texto = encodeURIComponent(`Olá! Sou ${nomeJogador}, fui campeão da temporada "${temporadaNome}" e gostaria de solicitar meu troféu. 🏆`);
  const linkWhatsApp = `https://wa.me/5522998345691?text=${texto}`;

  return (
    <div>
      <p>
        Parabéns {nomeJogador}! Você foi o grande campeão da temporada &ldquo;{temporadaNome}&rdquo; com {pontos} pontos! 🎉
      </p>
      <p>Seus números impressionantes:</p>
      <ul>
        <li>• {vitorias} vitórias</li>
        <li>• {gols} gols</li>
        <li>• {assistencias} assistências</li>
      </ul>
      <p>Continue assim, você é uma lenda do VemX1! 🌟</p>
      <p>🎁 Quer garantir seu troféu ou premiação?</p>
      <p>Fale agora com nosso suporte no WhatsApp clicando no botão abaixo e solicite sua recompensa exclusiva:</p>
      <Link href={linkWhatsApp} target="_blank">
        <span style={{ color: 'blue', textDecoration: 'underline' }}>
          👉 Pedir troféu no WhatsApp
        </span>
      </Link>
    </div>
  );
}

// Função para gerar texto simples para notificações
export function gerarTextoNotificacaoCampeaoPelada({ 
  nomeJogador, 
  pontos, 
  vitorias, 
  gols, 
  assistencias,
  temporadaNome 
}: Props): string {
  const texto = encodeURIComponent(`Olá! Sou ${nomeJogador}, fui campeão da temporada "${temporadaNome}" e gostaria de solicitar meu troféu. 🏆`);
  
  return `Parabéns ${nomeJogador}! Você foi o grande campeão da temporada "${temporadaNome}" com ${pontos} pontos! 🎉

Seus números impressionantes:
• ${vitorias} vitórias
• ${gols} gols
• ${assistencias} assistências

Continue assim, você é uma lenda do VemX1! 🌟

🎁 Quer garantir seu troféu ou premiação?
Fale agora com nosso suporte no WhatsApp clicando no botão abaixo e solicite sua recompensa exclusiva:
<a href="https://wa.me/5522998345691?text=${texto}" style="color:blue;text-decoration:underline;">👉 Pedir troféu no WhatsApp</a>`;
} 