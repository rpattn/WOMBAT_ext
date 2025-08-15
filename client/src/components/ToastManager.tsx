import React, { createContext, useContext, useMemo } from 'react';
import { ToastContainer, toast, type ToastOptions } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './ToastManager.css';

export type ToastLevel = 'info' | 'success' | 'warning' | 'error';

export type ToastAPI = {
  show: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastAPI | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const api = useMemo<ToastAPI>(() => ({
    show: (message, options) => toast(message, options),
    info: (message, options) => toast.info(message, options),
    success: (message, options) => toast.success(message, options),
    warning: (message, options) => toast.warning(message, options),
    error: (message, options) => toast.error(message, options),
  }), []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer
        position="top-left"
        theme="colored"
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        className="wombat-toast-container"
        toastClassName="wombat-toast"
        progressClassName="wombat-toast-progress"
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

