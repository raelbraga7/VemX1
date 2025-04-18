'use client'

// React imports
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Firebase imports
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'

// Context imports
import { useUser } from '@/contexts/UserContext'

// Service imports
import { sendConfirmationRequestToAllPlayers } from '@/firebase/notificationService'

// Third party imports
import { toast } from 'react-toastify'

export default function CriarPelada() {
  const router = useRouter()
  const { user } = useUser()
  const [nome, setNome] = useState('')
  const [local, setLocal] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      setLoading(true)

      // Cria um ID único para a pelada
      const peladaId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const peladaRef = doc(db, 'peladas', peladaId)

      // Dados da pelada
      const peladaData = {
        id: peladaId,
        nome,
        local,
        ownerId: user.uid,
        players: [user.uid],
        confirmados: [{
          nome: user.uid,
          dataConfirmacao: new Date().toISOString()
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        quantidadeTimes: 2,
        jogadoresPorTime: 5,
        ranking: {
          [user.uid]: {
            jogos: 0,
            vitorias: 0,
            derrotas: 0,
            empates: 0,
            gols: 0,
            assistencias: 0,
            pontos: 0
          }
        }
      }

      // Salva a pelada no Firestore
      await setDoc(peladaRef, peladaData)

      // Envia notificações para os jogadores
      await sendConfirmationRequestToAllPlayers(
        peladaId,
        nome,
        [user.uid]
      )

      toast.success('Pelada criada com sucesso!')
      router.push('/dashboard')
    } catch (error) {
      console.error('Erro ao criar pelada:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar pelada')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Criar Nova Pelada</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome da Pelada</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Local</label>
          <input
            type="text"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Criando...' : 'Criar Pelada'}
        </button>
      </form>
    </div>
  )
} 