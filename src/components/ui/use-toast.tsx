import * as React from "react";

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

interface ToastContextType {
  toast: (props: ToastProps) => void;
}

const ToastContext = React.createContext<ToastContextType>({
  toast: () => {}
});

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const showToast = (props: ToastProps) => {
    const { title, description, variant = 'default', duration = 3000 } = props;
    
    // Implementação básica: mostra um alerta no console
    console.log(`Toast (${variant}): ${title} - ${description}`);
    
    // Em uma implementação completa, você criaria um componente visual
    // e gerenciaria sua exibição/ocultação com estado
    
    // Adicione uma implementação visual temporária
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 p-4 rounded-md shadow-md max-w-md z-50 ${
      variant === 'destructive' ? 'bg-red-500 text-white' : 'bg-white text-gray-900'
    }`;
    
    const titleElement = document.createElement('h3');
    titleElement.className = 'font-medium';
    titleElement.textContent = title || '';
    
    const descElement = document.createElement('p');
    descElement.className = 'text-sm';
    descElement.textContent = description || '';
    
    toast.appendChild(titleElement);
    toast.appendChild(descElement);
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, duration);
  };
  
  return (
    <ToastContext.Provider value={{ toast: showToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
}; 