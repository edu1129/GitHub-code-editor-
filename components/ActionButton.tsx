
import React from 'react';
import { LoaderIcon } from './Icons';

interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, disabled, isLoading, children, icon, className = '' }) => {
  const baseClasses = "flex items-center justify-center gap-2 px-4 py-2 font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bunker-900";
  const colorClasses = "bg-sky-500 text-white hover:bg-sky-600 disabled:bg-bunker-700 disabled:text-bunker-400 disabled:cursor-not-allowed";
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${colorClasses} ${className}`}
    >
      {isLoading ? <LoaderIcon /> : icon}
      <span>{children}</span>
    </button>
  );
};

export default ActionButton;
