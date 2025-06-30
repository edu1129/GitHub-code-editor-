import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  ariaLabel: string;
}

const IconButton: React.FC<IconButtonProps> = ({ children, ariaLabel, ...props }) => {
  return (
    <button
      {...props}
      aria-label={ariaLabel}
      className="p-1.5 text-bunker-400 hover:text-bunker-100 hover:bg-bunker-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-500"
    >
      {children}
    </button>
  );
};

export default IconButton;
