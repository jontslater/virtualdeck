export type SupportEvent = {
  type: 'bits' | 'sub' | 'gift_sub';
  amount?: number;
};

export function supportEventToDamage(event: SupportEvent): number {
  if (event.type === 'bits') return (event.amount || 0) * 1;
  if (event.type === 'sub') return 500;
  if (event.type === 'gift_sub') return 250;
  return 0;
}

export default supportEventToDamage;
