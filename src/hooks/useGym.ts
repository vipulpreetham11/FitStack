import { useContext } from 'react'
import { GymContext } from '@/contexts/GymContext'
export function useGym() { const context = useContext(GymContext); if (!context) throw new Error('useGym requires GymProvider'); return context }
