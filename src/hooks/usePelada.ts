'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { PeladaConfig, Time } from '@/types/pelada';

export function usePelada(peladaId: string) {
  const [config, setConfig] = useState<PeladaConfig | null>(null);
  const [times, setTimes] = useState<Time[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carrega os dados iniciais
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Tenta carregar do localStorage primeiro
        const cachedData = localStorage.getItem(`pelada_${peladaId}_data`);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          setConfig(parsed.config);
          setTimes(parsed.times || []);
        }

        // Carrega dados do Firestore
        const peladaRef = doc(db, 'peladas', peladaId);
        const peladaDoc = await getDoc(peladaRef);
        
        if (peladaDoc.exists()) {
          const data = peladaDoc.data();
          const newConfig: PeladaConfig = {
            quantidadeTimes: data.quantidadeTimes || 2,
            jogadoresPorTime: data.jogadoresPorTime || 5,
            coresTimes: data.coresTimes || ['#ef4444', '#3b82f6'],
            confirmados: data.confirmados || [],
            dataCriacao: data.dataCriacao || new Date().toISOString()
          };

          setConfig(newConfig);
          
          // Salva no localStorage apenas o config
          localStorage.setItem(`pelada_${peladaId}_data`, JSON.stringify({
            config: newConfig,
            times: data.times || []
          }));

          // Se tiver times no Firestore, atualiza o estado
          if (data.times) {
            setTimes(data.times);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados da pelada:', err);
        setError('Não foi possível carregar os dados da pelada');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [peladaId]);

  // Função para salvar alterações
  const saveConfig = async (newConfig: PeladaConfig) => {
    try {
      // Atualiza o Firestore
      const peladaRef = doc(db, 'peladas', peladaId);
      await updateDoc(peladaRef, {
        quantidadeTimes: newConfig.quantidadeTimes,
        jogadoresPorTime: newConfig.jogadoresPorTime,
        coresTimes: newConfig.coresTimes,
        confirmados: newConfig.confirmados,
        dataAtualizacao: new Date()
      });

      // Atualiza o estado
      setConfig(newConfig);

      // Atualiza o localStorage
      localStorage.setItem(`pelada_${peladaId}_data`, JSON.stringify({
        config: newConfig,
        times: times
      }));

      return true;
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
      setError('Não foi possível salvar as alterações');
      return false;
    }
  };

  // Função para salvar times
  const saveTimes = (newTimes: Time[]) => {
    setTimes(newTimes);
    // Atualiza o localStorage
    localStorage.setItem(`pelada_${peladaId}_data`, JSON.stringify({
      config,
      times: newTimes
    }));
  };

  return {
    config,
    times,
    loading,
    error,
    saveConfig,
    saveTimes
  };
} 