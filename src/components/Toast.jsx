import { createContext, useCallback, useContext, useState } from 'react'
import Icon from './Icon.jsx'

const ToastContext = createContext(() => {})

/**
 * toast({ title, details, tone: 'success'|'danger'|'info', actions: [{ label, onClick, primary }] })
 * Toasts with actions stay until the user picks one or dismisses it.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback(
    (t) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((list) => [...list.slice(-2), { tone: 'success', ...t, id }])
      if (!t.actions?.length) setTimeout(() => dismiss(id), 6000)
    },
    [dismiss],
  )
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <Icon name={t.tone === 'danger' ? 'alert' : t.tone === 'info' ? 'info' : 'checkCircle'} className="toast-icon" />
            <div className="toast-content">
              <p className="toast-title">{t.title}</p>
              {t.details && <p className="toast-details">{t.details}</p>}
              {t.actions?.length > 0 && (
                <div className="toast-actions">
                  {t.actions.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      className={a.primary ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                      onClick={() => {
                        dismiss(t.id)
                        a.onClick()
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="btn-icon" onClick={() => dismiss(t.id)} aria-label="Dismiss message">
              <Icon name="x" size={18} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
