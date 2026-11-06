export function BlurFade({ as: Element = 'div', className = '', children, ...props }) {
  return <Element className={`magic-blur-fade ${className}`.trim()} {...props}>{children}</Element>
}
