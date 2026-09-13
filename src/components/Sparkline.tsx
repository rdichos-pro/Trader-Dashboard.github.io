import React from 'react';

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  isPositive?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color,
  width = 90,
  height = 28,
  isPositive = true,
}) => {
  if (!data || data.length < 2) {
    return <div className="h-7 w-20 bg-slate-800/40 rounded animate-pulse" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const padding = 3;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - padding * 2) + padding;
      const y = height - ((val - min) / range) * (height - padding * 2) - padding;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const strokeColor = color || (isPositive ? '#10b981' : '#f43f5e');
  const fillColor = color 
    ? (color.startsWith('#') ? `${color}25` : color) 
    : (isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)');

  const firstPoint = points.split(' ')[0];
  const lastPoint = points.split(' ')[points.split(' ').length - 1];
  const areaPoints = `${firstPoint.split(',')[0]},${height} ${points} ${lastPoint.split(',')[0]},${height}`;

  return (
    <svg width={width} height={height} className="overflow-visible inline-block">
      <polygon points={areaPoints} fill={fillColor} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};
