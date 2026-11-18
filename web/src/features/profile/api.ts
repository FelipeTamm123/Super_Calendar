import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from '../../lib/api'

export type Profile = {
  id: string
  username: string | null
  full_name: string | null
  created_at: string
  updated_at: string
}

export type ProfileUpdate = { username?: string | null; full_name?: string | null }

const profileKey = ['profile', 'me'] as const

export function useProfile() {
  return useQuery({
    queryKey: profileKey,
    queryFn: ({ signal }) => request<Profile>('/profiles/me', { signal }),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProfileUpdate) => request<Profile>('/profiles/me', { method: 'PATCH', body: data }),
    onSuccess: (profile) => qc.setQueryData(profileKey, profile),
  })
}
