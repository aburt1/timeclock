import type { ReactElement } from 'react';

export const SHAPES = [
  'circle',
  'square',
  'triangle',
  'star',
  'heart',
  'diamond',
  'hexagon',
  'pentagon',
  'cross',
] as const;

export type Shape = (typeof SHAPES)[number];

export const COLOR_CHOICES = [
  '#1976D2',
  '#7B1FA2',
  '#F57C00',
  '#FBC02D',
  '#E91E63',
  '#00ACC1',
  '#795548',
  '#303F9F',
  '#AD1457',
  '#2E7D32',
  '#5D4037',
  '#455A64',
];

function shapeElement(shape: string, color: string): ReactElement {
  switch (shape) {
    case 'square':
      return <rect x="12" y="12" width="76" height="76" rx="12" fill={color} />;
    case 'triangle':
      return <polygon points="50,8 92,88 8,88" fill={color} />;
    case 'star':
      return (
        <polygon
          points="50,5 61,38 96,38 67,59 78,92 50,71 22,92 33,59 4,38 39,38"
          fill={color}
        />
      );
    case 'heart':
      return (
        <path
          d="M50,88 C20,65 5,45 5,28 C5,12 20,2 35,8 C45,12 50,22 50,22 C50,22 55,12 65,8 C80,2 95,12 95,28 C95,45 80,65 50,88 Z"
          fill={color}
        />
      );
    case 'diamond':
      return <polygon points="50,5 95,50 50,95 5,50" fill={color} />;
    case 'hexagon':
      return <polygon points="50,5 90,27 90,73 50,95 10,73 10,27" fill={color} />;
    case 'pentagon':
      return <polygon points="50,5 95,38 78,90 22,90 5,38" fill={color} />;
    case 'cross':
      return (
        <polygon
          points="35,5 65,5 65,35 95,35 95,65 65,65 65,95 35,95 35,65 5,65 5,35 35,35"
          fill={color}
        />
      );
    case 'circle':
    default:
      return <circle cx="50" cy="50" r="42" fill={color} />;
  }
}

export function ShapeIcon({
  shape,
  color,
  className,
}: {
  shape: string;
  color: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {shapeElement(shape, color)}
    </svg>
  );
}
