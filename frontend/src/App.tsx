import { Route, Routes } from 'react-router-dom'

import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { ToastViewport } from './components/ToastViewport'
import { ActivityProvider } from './hooks/useActivity'
import { ToastProvider } from './hooks/useToast'
import { WalletProvider } from './hooks/useWallet'
import { CampaignPage } from './pages/CampaignPage'
import { CreatePage } from './pages/CreatePage'
import { HomePage } from './pages/HomePage'
import { EmptyState } from './components/ui'

export function App() {
  return (
    <ErrorBoundary>
      {/* Toasts first: the activity feed announces new events through them. */}
      <ToastProvider>
        <WalletProvider>
          <ActivityProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="create" element={<CreatePage />} />
                <Route path="campaign/:id" element={<CampaignPage />} />
                <Route
                  path="*"
                  element={
                    <EmptyState title="Page not found" message="That route does not exist." />
                  }
                />
              </Route>
            </Routes>
            <ToastViewport />
          </ActivityProvider>
        </WalletProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
