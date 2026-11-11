import { useContext } from 'react'
import { AppDispatchContext, AppStateContext } from './context'

/** Read the whole store. Usage: const { workOrders, site } = useAppState() */
export function useAppState() {
  const state = useContext(AppStateContext)
  if (!state) throw new Error('useAppState must be used inside <AppProvider>')
  return state
}

/** Get dispatch. Usage: const dispatch = useAppDispatch(); dispatch(actions.setSite('HBT')) */
export function useAppDispatch() {
  const dispatch = useContext(AppDispatchContext)
  if (!dispatch) throw new Error('useAppDispatch must be used inside <AppProvider>')
  return dispatch
}
