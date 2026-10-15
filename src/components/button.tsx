import type { ButtonHTMLAttributes } from "react";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};
export function Button({
  variant = "secondary",
  className = "",
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={`ui-button ui-button--${variant} ${className}`}
    />
  );
}
