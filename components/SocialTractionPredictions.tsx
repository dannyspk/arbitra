'use client'

import React from 'react'
import Link from 'next/link'

interface TractionPrediction {
  symbol: string
  base: string
  traction_score: number
  galaxy_score: number
  alt_rank: number
  interactions_24h: number
  num_posts: number
  tweet_sentiment: number
  price_change_24h: number
  price_change_7d: number
  volume_24h?: number
  prediction: 'HIGH' | 'MEDIUM' | 'LOW'
  reason: string
}

export default function SocialTractionPredictions() {
  const [predictions, setPredictions] = React.useState<TractionPrediction[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = React.useState<number>(0)

  const fetchPredictions = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
      const response = await fetch(`${backend}/api/social-traction`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.predictions) {
        setPredictions(data.predictions)
        setLastUpdate(Date.now())
      }
    } catch (err: any) {
      console.error('Error fetching social traction predictions:', err)
      setError(err.message || 'Failed to load predictions')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchPredictions()
    // Refresh every 5 minutes
    const interval = setInterval(fetchPredictions, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getPredictionColor = (prediction: string) => {
    switch (prediction) {
      case 'HIGH': return 'from-emerald-500 to-green-500'
      case 'MEDIUM': return 'from-yellow-500 to-amber-500'
      case 'LOW': return 'from-slate-500 to-gray-500'
      default: return 'from-slate-500 to-gray-500'
    }
  }

  const getPredictionBg = (prediction: string) => {
    switch (prediction) {
      case 'HIGH': return 'bg-emerald-500/10 border-emerald-500/30'
      case 'MEDIUM': return 'bg-yellow-500/10 border-yellow-500/30'
      case 'LOW': return 'bg-slate-500/10 border-slate-500/30'
      default: return 'bg-slate-500/10 border-slate-500/30'
    }
  }

  if (loading && predictions.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          <p className="text-slate-400">Analyzing 100+ recently listed Binance coins...</p>
          <p className="text-xs text-slate-500">Hunting for 10x gems with LunarCrush</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="text-red-400 text-4xl">⚠️</div>
          <p className="text-slate-300">Failed to load social traction data</p>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={fetchPredictions}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-2">
              <span className="text-3xl">💎</span>
              Low-Cap Gem Finder
            </h2>
            <p className="text-slate-400 mt-2">
              Recently listed coins with social buzz • Hunt the next 10x • Powered by LunarCrush
            </p>
          </div>
          <button
            onClick={fetchPredictions}
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {lastUpdate > 0 && (
          <p className="text-xs text-slate-500">
            Last updated: {new Date(lastUpdate).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Predictions Grid */}
      {predictions.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8 text-center">
          <p className="text-slate-400">No predictions available at the moment</p>
          <p className="text-sm text-slate-500 mt-2">Try refreshing in a few minutes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {predictions.map((pred, index) => (
            <Link
              key={index}
              href={`/trading?symbol=${pred.symbol}&market=future`}
              className="group"
            >
              <div className={`relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-5 border ${getPredictionBg(pred.prediction)} hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1`}>
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/5 group-hover:to-pink-500/5 rounded-xl transition-all duration-300"></div>
                
                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-bold text-white text-xl">{pred.base}</div>
                      <div className="text-xs text-slate-400">/ USDT</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${getPredictionColor(pred.prediction)} text-white`}>
                      {pred.prediction}
                    </div>
                  </div>

                  {/* Traction Score */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Traction Score</span>
                      <span className="font-bold text-white">{pred.traction_score}/100</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${getPredictionColor(pred.prediction)} transition-all duration-500`}
                        style={{ width: `${pred.traction_score}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-800/50 rounded-lg p-2">
                      <div className="text-xs text-slate-400">Galaxy Score</div>
                      <div className="text-sm font-bold text-white">{pred.galaxy_score}/100</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2">
                      <div className="text-xs text-slate-400">24h Volume</div>
                      <div className="text-sm font-bold text-cyan-400">
                        {pred.volume_24h ? `$${(pred.volume_24h / 1e6).toFixed(1)}M` : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2">
                      <div className="text-xs text-slate-400">Sentiment</div>
                      <div className={`text-sm font-bold ${pred.tweet_sentiment > 0.6 ? 'text-green-400' : pred.tweet_sentiment > 0.5 ? 'text-yellow-400' : 'text-slate-400'}`}>
                        {(pred.tweet_sentiment * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2">
                      <div className="text-xs text-slate-400">24h Change</div>
                      <div className={`text-sm font-bold ${pred.price_change_24h > 0 ? 'text-green-400' : pred.price_change_24h < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {pred.price_change_24h > 0 ? '+' : ''}{pred.price_change_24h.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="border-t border-slate-700/50 pt-3">
                    <div className="text-xs text-slate-400 leading-relaxed">
                      {pred.reason}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-4">
                    <div className="w-full py-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-lg text-center text-sm font-semibold text-purple-300 group-hover:from-purple-600/30 group-hover:to-pink-600/30 group-hover:border-purple-500/50 transition-all">
                      View Chart →
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Info Footer */}
      <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div>
            <h4 className="font-semibold text-white mb-1">How Low-Cap Gem Finder Works</h4>
            <p className="text-sm text-slate-300">
              We scan all Binance USDT pairs for low-cap coins ($500K-$50M daily volume), then analyze social sentiment to find gems with growing community interest before they moon. 
              Perfect for finding the next 10x before it happens.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-xs text-emerald-300">
                HIGH = 80+ Score • Strong potential
              </span>
              <span className="px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded text-xs text-yellow-300">
                MEDIUM = 60-80 Score • Watch closely
              </span>
              <span className="px-2 py-1 bg-slate-500/20 border border-slate-500/30 rounded text-xs text-slate-300">
                LOW = 40-60 Score • Early stage
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
