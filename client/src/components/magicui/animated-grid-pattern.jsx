import { useId } from 'react'

export function AnimatedGridPattern({ className = '' }) {
  const patternId = useId().replaceAll(':', '')
  return <svg className={`animated-grid-pattern ${className}`.trim()} aria-hidden="true" viewBox="0 0 400 400" preserveAspectRatio="none">
    <defs>
      <pattern id={patternId} width="34" height="34" patternUnits="userSpaceOnUse">
        <path d="M 34 0 L 0 0 0 34" fill="none" className="animated-grid-line"/>
      </pattern>
      <radialGradient id={`${patternId}-fade`}>
        <stop offset="0%" stopColor="white" stopOpacity=".9"/>
        <stop offset="82%" stopColor="white" stopOpacity=".45"/>
        <stop offset="100%" stopColor="white" stopOpacity="0"/>
      </radialGradient>
      <mask id={`${patternId}-mask`}><rect width="400" height="400" fill={`url(#${patternId}-fade)`}/></mask>
    </defs>
    <rect width="400" height="400" fill={`url(#${patternId})`} mask={`url(#${patternId}-mask)`}/>
  </svg>
}
