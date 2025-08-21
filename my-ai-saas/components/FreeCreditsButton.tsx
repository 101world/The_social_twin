'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Gift, Loader2, CheckCircle } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'

interface FreeCreditsButtonProps {
  className?: string
}

export default function FreeCreditsButton({ className }: FreeCreditsButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isRedeemed, setIsRedeemed] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const { isSignedIn, userId } = useAuth()

  // Check if user has already claimed credits
  useEffect(() => {
    if (isSignedIn && userId) {
      checkClaimStatus()
    }
  }, [isSignedIn, userId])

  const checkClaimStatus = async () => {
    setIsCheckingStatus(true)
    try {
      const response = await fetch('/api/users/free-credits/status')
      const data = await response.json()
      
      if (response.ok) {
        setIsRedeemed(data.hasClaimed)
      }
    } catch (error) {
      console.error('Error checking claim status:', error)
    } finally {
      setIsCheckingStatus(false)
    }
  }

  const handleClaimCredits = async () => {
    if (!isSignedIn) {
      alert('Please sign in to claim free credits')
      return
    }

    if (isRedeemed) {
      alert('You have already claimed your free credits!')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/users/free-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to claim credits')
      }

      setIsRedeemed(true)
      alert(`🎉 Successfully claimed ${data.credits_added} free credits!`)
    } catch (error) {
      console.error('Error claiming credits:', error)
      if (error instanceof Error) {
        alert(error.message)
      } else {
        alert('Failed to claim free credits. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSignedIn) {
    return (
      <Button 
        variant="outline" 
        className={`group relative overflow-hidden border-2 border-dashed border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 hover:from-purple-100 hover:to-pink-100 hover:border-purple-400 transition-all duration-300 ${className}`}
        onClick={() => alert('Please sign in to claim your free credits')}
      >
        <Gift className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
        Sign in to Claim 1000 Free Credits
      </Button>
    )
  }

  if (isCheckingStatus) {
    return (
      <Button 
        disabled
        className={`group relative overflow-hidden bg-gradient-to-r from-gray-400 to-gray-500 text-white border-0 ${className}`}
      >
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Checking Status...
      </Button>
    )
  }

  return (
    <Button 
      onClick={handleClaimCredits}
      disabled={isLoading || isRedeemed}
      className={`group relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Claiming Credits...
        </>
      ) : isRedeemed ? (
        <>
          <CheckCircle className="w-4 h-4 mr-2" />
          Credits Claimed!
        </>
      ) : (
        <>
          <Gift className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
          Claim 1000 Free Credits
          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </>
      )}
    </Button>
  )
}
