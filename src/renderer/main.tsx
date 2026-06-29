import { ThemeProvider } from '@renderer/contexts/ThemeContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            className: 'dark:bg-gray-800 dark:text-white'
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
