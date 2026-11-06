import { Button } from '../ui/button.jsx'

export function ShimmerButton({ children, className = '', ...props }) {
  return <Button className={`magic-shimmer-button ${className}`.trim()} {...props}>{children}</Button>
}
