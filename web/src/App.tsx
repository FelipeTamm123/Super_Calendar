import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { createBrowserRouter, Link, Navigate, RouterProvider } from 'react-router'
import { Layout } from './components/Layout'
import { GuestOnly, RequireAuth } from './components/RouteGuards'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { SignupPage } from './features/auth/SignupPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { GoogleCallbackPage } from './features/calendar/GoogleCallbackPage'
import { NoteDetailPage } from './features/notes/NoteDetailPage'
import { NotesPage } from './features/notes/NotesPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { QuestionsPage } from './features/questions/QuestionsPage'
import { SchedulePage } from './features/schedule/SchedulePage'
import { SubjectSheetPage } from './features/subjects/SubjectSheetPage'
import { SubjectsPage } from './features/subjects/SubjectsPage'
import { TodayPage } from './features/today/TodayPage'
import { ApiError } from './lib/api'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // No reintentar errores del cliente (4xx): no se van a arreglar solos
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
      },
    },
  })
}

function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="text-xl font-semibold">Esta página no existe</h1>
      <Link to="/" className="text-sm font-medium text-brand-600 hover:underline">
        Volver al inicio
      </Link>
    </main>
  )
}

const createRouter = () => createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <Navigate to="/hoy" replace /> },
          { path: '/hoy', element: <TodayPage /> },
          { path: '/apuntes', element: <NotesPage /> },
          { path: '/apuntes/:id', element: <NoteDetailPage /> },
          { path: '/preguntas', element: <QuestionsPage /> },
          { path: '/horario', element: <SchedulePage /> },
          { path: '/calendario', element: <CalendarPage /> },
          { path: '/calendario/google/callback', element: <GoogleCallbackPage /> },
          { path: '/materias', element: <SubjectsPage /> },
          { path: '/materias/:id', element: <SubjectSheetPage /> },
          { path: '/perfil', element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
])

export default function App() {
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(createRouter)
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
