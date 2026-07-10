import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Product } from '../types';

export type ImageModalTab = 'info' | 'imagens' | 'analytics';

interface ImageModalContextValue {
  product: Product | null;
  isOpen: boolean;
  initialTab: ImageModalTab;
  openImageModal: (product: Product, tab?: ImageModalTab) => void;
  closeImageModal: () => void;
}

const ImageModalContext = createContext<ImageModalContextValue | null>(null);

export function ImageModalProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<ImageModalTab>('info');

  return (
    <ImageModalContext.Provider
      value={{
        product,
        isOpen,
        initialTab,
        openImageModal: (p, tab = 'info') => {
          setProduct(p);
          setInitialTab(tab);
          setIsOpen(true);
        },
        closeImageModal: () => setIsOpen(false),
      }}
    >
      {children}
    </ImageModalContext.Provider>
  );
}

export function useImageModal() {
  const ctx = useContext(ImageModalContext);
  if (!ctx) throw new Error('useImageModal deve ser usado dentro de ImageModalProvider');
  return ctx;
}
