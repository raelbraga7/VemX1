import * as React from "react";

const buttonVariants = {
  default: "bg-blue-600 text-white hover:bg-blue-700",
  outline: "bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-100",
  secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  ghost: "bg-transparent hover:bg-gray-100",
  link: "bg-transparent text-blue-600 hover:underline"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  className?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", ...props }, ref) => {
    return (
      <button
        className={`px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${buttonVariants[variant]} ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button"; 