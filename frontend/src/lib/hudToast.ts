import { toast } from 'sonner';

const baseStyle = {
  background: '#071228',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '12px',
  letterSpacing: '0.1em',
  borderRadius: 0,
};

export const hudToast = {
  success(msg: string) {
    toast(`[ ${msg} ]`, {
      style: { ...baseStyle, color: '#22c55e', border: '1px solid #22c55e' },
    });
  },
  error(msg: string) {
    toast(`[ ${msg} ]`, {
      style: { ...baseStyle, color: '#ef4444', border: '1px solid #ef4444' },
    });
  },
  info(msg: string) {
    toast(`[ ${msg} ]`, {
      style: { ...baseStyle, color: '#00d4ff', border: '1px solid #00b4d8' },
    });
  },
};
