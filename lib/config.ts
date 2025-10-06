// API Configuration
// This file provides a centralized way to get the API URL
// It uses environment variables for flexibility across environments

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

export const getApiUrl = (): string => {
  return API_URL
}

// Check if we're in production mode
export const isProduction = process.env.NODE_ENV === 'production'

// Check if we're in local development
export const isDevelopment = process.env.NODE_ENV === 'development'
