import { motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Database, GitBranch, Variable, Play } from 'lucide-react';
import { useState } from 'react';

type NodeType = 'input' | 'process' | 'variable' | 'output';
type NodeState = 'idle' | 'running' | 'success' | 'error' | 'selected';

interface WorkflowNodeProps {
  type: NodeType;
  state?: NodeState;
  title: string;
  subtitle?: string;
  metadata?: string[];
  hasInputPort?: boolean;
  hasOutputPort?: boolean;
  onSelect?: () => void;
}

const typeConfig = {
  input: {
    color: 'emerald',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    borderColor: 'rgb(16, 185, 129)',
    icon: Database,
  },
  process: {
    color: 'blue',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    borderColor: 'rgb(59, 130, 246)',
    icon: GitBranch,
  },
  variable: {
    color: 'orange',
    glowColor: 'rgba(251, 146, 60, 0.4)',
    borderColor: 'rgb(251, 146, 60)',
    icon: Variable,
  },
  output: {
    color: 'purple',
    glowColor: 'rgba(168, 85, 247, 0.4)',
    borderColor: 'rgb(168, 85, 247)',
    icon: Play,
  },
};

export function WorkflowNode({
  type,
  state = 'idle',
  title,
  subtitle,
  metadata = [],
  hasInputPort = true,
  hasOutputPort = true,
  onSelect,
}: WorkflowNodeProps) {
  const config = typeConfig[type];
  const Icon = config.icon;
  const [isHovered, setIsHovered] = useState(false);

  const getStateStyles = () => {
    switch (state) {
      case 'running':
        return {
          shadow: `0 0 20px ${config.glowColor}, 0 8px 32px rgba(0, 0, 0, 0.3)`,
          borderColor: config.borderColor,
        };
      case 'success':
        return {
          shadow: `0 0 15px rgba(16, 185, 129, 0.3), 0 8px 32px rgba(0, 0, 0, 0.3)`,
          borderColor: 'rgb(16, 185, 129)',
        };
      case 'error':
        return {
          shadow: `0 0 20px rgba(239, 68, 68, 0.4), 0 8px 32px rgba(0, 0, 0, 0.3)`,
          borderColor: 'rgb(239, 68, 68)',
        };
      case 'selected':
        return {
          shadow: `0 0 25px ${config.glowColor}, 0 12px 40px rgba(0, 0, 0, 0.4)`,
          borderColor: config.borderColor,
        };
      default:
        return {
          shadow: `0 0 8px ${config.glowColor}, 0 4px 20px rgba(0, 0, 0, 0.3)`,
          borderColor: config.borderColor,
        };
    }
  };

  const stateStyles = getStateStyles();

  return (
    <motion.div
      className="relative inline-block"
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      {/* Input Port */}
      {hasInputPort && (
        <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div
            className="w-3 h-3 rounded-full border-2 transition-all duration-200"
            style={{
              backgroundColor: '#1e293b',
              borderColor: isHovered ? stateStyles.borderColor : '#475569',
              boxShadow: isHovered ? `0 0 8px ${config.glowColor}` : 'none',
            }}
          />
        </div>
      )}

      {/* Output Port */}
      {hasOutputPort && (
        <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 z-10">
          <div
            className="w-3 h-3 rounded-full border-2 transition-all duration-200"
            style={{
              backgroundColor: '#1e293b',
              borderColor: isHovered ? stateStyles.borderColor : '#475569',
              boxShadow: isHovered ? `0 0 8px ${config.glowColor}` : 'none',
            }}
          />
        </div>
      )}

      {/* Node Container */}
      <motion.div
        className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 min-w-[240px] cursor-pointer"
        style={{
          boxShadow: stateStyles.shadow,
          border: `1px solid ${stateStyles.borderColor}`,
        }}
        animate={{
          scale: state === 'selected' ? 1.05 : 1,
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Running Animation - Orbiting Border */}
        {state === 'running' && (
          <>
            <motion.div
              className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none"
              style={{
                background: `conic-gradient(from 0deg, transparent 0%, ${config.borderColor} 5%, transparent 10%)`,
              }}
              animate={{ rotate: 360 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
            <div
              className="absolute inset-[1px] bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl"
              style={{ zIndex: 1 }}
            />
          </>
        )}

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="p-2 rounded-lg"
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: `1px solid ${config.borderColor}`,
                boxShadow: `0 0 12px ${config.glowColor}`,
              }}
            >
              <Icon className="w-4 h-4" style={{ color: config.borderColor }} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-white">{title}</h3>
              {subtitle && (
                <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Metadata */}
          {metadata.length > 0 && (
            <div className="space-y-1.5">
              {metadata.map((item, index) => (
                <div
                  key={index}
                  className="text-xs text-slate-300 bg-slate-950/40 rounded px-2 py-1.5 border border-slate-700/50"
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Success Badge */}
        {state === 'success' && (
          <motion.div
            className="absolute -top-2 -right-2 bg-emerald-500 rounded-full p-1.5 shadow-lg"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
            style={{
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)',
            }}
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
          </motion.div>
        )}

        {/* Error Badge */}
        {state === 'error' && (
          <motion.div
            className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1.5 shadow-lg"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
            style={{
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)',
            }}
          >
            <AlertCircle className="w-4 h-4 text-white" />
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
