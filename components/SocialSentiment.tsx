'use client'

import React, { useState, useEffect } from 'react'

interface SocialSentimentProps {
  symbol: string
}

interface SocialData {
  twitter_sentiment?: 'bullish' | 'bearish' | 'neutral'
  sentiment_score?: number
  sentiment_label?: string
  galaxy_score?: number
  alt_rank?: number
  topic_rank?: number
  social_volume?: number
  interactions_24h?: number
  tweets_24h?: number
  news_24h?: number
  reddit_24h?: number
  tweet_sentiment?: number
  news_sentiment?: number
  reddit_sentiment?: number
  social_dominance?: number
  trend?: string
  data_source?: string
}

export default function SocialSentiment({ symbol }: SocialSentimentProps) {
  const [socialData, setSocialData] = useState<SocialData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) {
      setSocialData(null)
      return
    }

    const fetchSocialData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Extract base symbol (remove USDT, BUSD, etc.)
        const baseSymbol = symbol.replace(/USDT|BUSD|USD|PERP$/i, '').toLowerCase()
        console.log('SocialSentiment: Fetching for symbol:', baseSymbol)
        
        // Call backend API which will use Santiment
        let backend = ''
        try {
          const hn = location.hostname
          const p = location.port
          if ((hn === 'localhost' || hn === '127.0.0.1') && p === '3000') {
            backend = 'http://127.0.0.1:8000'
          }
        } catch (e) {}
        
        const response = await fetch(`${backend}/api/social-sentiment/${baseSymbol}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch social sentiment data')
        }

        const data = await response.json()
        console.log('SocialSentiment: Data received:', data)
        
        if (data.error) {
          throw new Error(data.error)
        }
        
        setSocialData(data)
        
      } catch (err: any) {
        console.error('SocialSentiment: Error:', err)
        setError('Social data not available for this symbol')
        setSocialData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchSocialData()
  }, [symbol])

  const getSentimentColor = (sentiment?: string) => {
    if (!sentiment) return 'text-slate-400'
    const s = sentiment.toLowerCase()
    if (s.includes('bullish')) return 'text-green-400'
    if (s.includes('bearish')) return 'text-red-400'
    return 'text-slate-400'
  }

  const getSentimentBg = (sentiment?: string) => {
    if (!sentiment) return 'bg-slate-500/10 border-slate-500/30'
    const s = sentiment.toLowerCase()
    if (s.includes('bullish')) return 'bg-green-500/10 border-green-500/30'
    if (s.includes('bearish')) return 'bg-red-500/10 border-red-500/30'
    return 'bg-slate-500/10 border-slate-500/30'
  }

  const formatNumber = (num: number | undefined) => {
    if (!num) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  if (!symbol) {
    return null
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
          Social Sentiment
        </h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
        </div>
      </div>
    )
  }

  if (error || !socialData) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
          Social Sentiment
        </h3>
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
          <div className="flex items-start gap-3 text-slate-400 text-sm">
            <svg className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-slate-300 font-medium mb-1">No social data available</p>
              <p className="text-xs text-slate-500">
                This symbol may not be tracked by social platforms yet, or it might be a newer listing. Try popular coins like BTC, ETH, or SOL.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border border-slate-700/50 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
          Social Sentiment
        </h3>
        
        {/* Sentiment Badge */}
        <div className={`px-3 py-1 rounded-full border ${getSentimentBg(socialData.sentiment_label || socialData.twitter_sentiment)}`}>
          <span className={`text-sm font-semibold ${getSentimentColor(socialData.sentiment_label || socialData.twitter_sentiment)} capitalize`}>
            {(socialData.sentiment_label || socialData.twitter_sentiment || 'Neutral').replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Sentiment Score Bar */}
      {socialData.sentiment_score !== undefined && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-400">Social Sentiment Score</span>
            <span className="text-sm font-semibold text-white">{Math.round(socialData.sentiment_score)}/100</span>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                socialData.sentiment_score > 60 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-400' 
                  : socialData.sentiment_score < 40 
                  ? 'bg-gradient-to-r from-red-500 to-orange-400'
                  : 'bg-gradient-to-r from-slate-500 to-slate-400'
              }`}
              style={{ width: `${Math.min(socialData.sentiment_score, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Social Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Social Volume */}
        {socialData.social_volume !== undefined && (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span className="text-xs text-slate-400">Social Volume</span>
            </div>
            <div className="text-lg font-bold text-white">{formatNumber(socialData.social_volume)}</div>
            <div className="text-xs text-slate-500">mentions (24h)</div>
          </div>
        )}

        {/* Interactions 24h */}
        {socialData.interactions_24h !== undefined && (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
              <span className="text-xs text-slate-400">Interactions</span>
            </div>
            <div className="text-lg font-bold text-white">{formatNumber(socialData.interactions_24h)}</div>
            <div className="text-xs text-slate-500">total (24h)</div>
          </div>
        )}

        {/* Tweets 24h */}
        {socialData.tweets_24h !== undefined && (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-xs text-slate-400">Tweets</span>
            </div>
            <div className="text-lg font-bold text-white">{formatNumber(socialData.tweets_24h)}</div>
            <div className="text-xs text-slate-500">posts (24h)</div>
          </div>
        )}

        {/* Trend */}
        {socialData.trend !== undefined && (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-xs text-slate-400">Trend</span>
            </div>
            <div className={`text-lg font-bold capitalize ${
              socialData.trend.toLowerCase() === 'up' ? 'text-green-400' :
              socialData.trend.toLowerCase() === 'down' ? 'text-red-400' :
              'text-slate-400'
            }`}>
              {socialData.trend.toLowerCase() === 'up' && '↑ '}
              {socialData.trend.toLowerCase() === 'down' && '↓ '}
              {socialData.trend.toLowerCase() === 'flat' && '→ '}
              {socialData.trend}
            </div>
            <div className="text-xs text-slate-500">momentum</div>
          </div>
        )}

        {/* Twitter Sentiment */}
        {socialData.tweet_sentiment !== undefined && (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              <span className="text-xs text-slate-400">Twitter Sentiment</span>
            </div>
            <div className={`text-lg font-bold ${
              socialData.tweet_sentiment >= 70 ? 'text-green-400' :
              socialData.tweet_sentiment >= 50 ? 'text-yellow-400' :
              'text-red-400'
            }`}>{socialData.tweet_sentiment}/100</div>
            <div className="text-xs text-slate-500">positivity score</div>
          </div>
        )}

        {/* Topic Rank */}
        {socialData.topic_rank !== undefined && (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-xs text-slate-400">Topic Rank</span>
            </div>
            <div className="text-lg font-bold text-white">#{socialData.topic_rank}</div>
            <div className="text-xs text-slate-500">trending position</div>
          </div>
        )}
      </div>

      {/* Additional Info */}
      <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
        <div className="flex items-start gap-2 text-xs text-purple-300">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>
            Real-time social intelligence from LunarCrush. Metrics show community engagement and market sentiment across social platforms.
          </p>
        </div>
      </div>
    </div>
  )
}
