import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 font-semibold text-sm rounded-[var(--radius-button)] transition-colors disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent-light",
        secondary:
          "bg-white border border-border-strong text-text-primary hover:bg-page",
        ghost: "text-primary font-medium hover:bg-primary/5",
        destructive: "bg-destructive text-white hover:bg-red-700",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        default: "px-4 py-2.5",
        lg: "px-5 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);

export { buttonVariants };
