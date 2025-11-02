import { useCallback, useState } from "react";

interface ConfirmationOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
 icon?: "trash" | "warning" | "close"| "zap";
}

interface ConfirmationState extends ConfirmationOptions {
  open: boolean;
  onConfirm?: () => void;
}

export function useConfirmation() {
  const [state, setState] = useState<ConfirmationState>({
    open: false,
    title: "",
    description: "",
  });

  const confirm = useCallback((options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        ...options,
        open: true,
        onConfirm: () => {
          setState(prev => ({ ...prev, open: false }));
          resolve(true);
        },
      });
    });
  }, []);

  const cancel = useCallback(() => {
    setState(prev => ({ ...prev, open: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    if (state.onConfirm) {
      state.onConfirm();
    }
  }, [state.onConfirm]);

  return {
    confirm,
    cancel,
    handleConfirm,
    confirmationState: state,
  };
}
