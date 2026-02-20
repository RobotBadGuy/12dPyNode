import { motion } from 'motion/react';

interface NodeConnectorProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
  animated?: boolean;
}

export function NodeConnector({
  startX,
  startY,
  endX,
  endY,
  color = 'rgb(59, 130, 246)',
  animated = false,
}: NodeConnectorProps) {
  // Calculate the control points for a smooth curve
  const midX = (startX + endX) / 2;
  const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`gradient-${startX}-${startY}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="50%" stopColor={color} stopOpacity="0.6" />
          <stop offset="100%" stopColor={color} stopOpacity="0.3" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow layer */}
      <motion.path
        d={path}
        stroke={color}
        strokeWidth="3"
        fill="none"
        opacity="0.3"
        filter="url(#glow)"
      />

      {/* Main line */}
      <motion.path
        d={path}
        stroke={`url(#gradient-${startX}-${startY})`}
        strokeWidth="2"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />

      {/* Animated pulse */}
      {animated && (
        <motion.circle
          r="3"
          fill={color}
          filter="url(#glow)"
        >
          <animateMotion dur="2s" repeatCount="indefinite">
            <mpath href={`#path-${startX}-${startY}`} />
          </animateMotion>
        </motion.circle>
      )}
      
      {animated && (
        <path id={`path-${startX}-${startY}`} d={path} fill="none" stroke="none" />
      )}
    </svg>
  );
}
