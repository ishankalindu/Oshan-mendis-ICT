const variants = {
  default: 'bg-[#4266d5] text-white shadow-sm hover:bg-[#3453b6]',
  outline: 'border border-current bg-transparent hover:bg-black/5',
  whatsapp: 'bg-[#168a68] text-white shadow-sm hover:bg-[#117456]',
}

const sizes = {
  default: 'min-h-12 px-5 py-3 text-sm',
  sm: 'min-h-10 px-4 py-2 text-xs',
  icon: 'size-10 p-0',
}

export function Button({ className = '', variant = 'default', size = 'default', type = 'button', ...props }) {
  return <button
    data-slot="button"
    type={type}
    className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`.trim()}
    {...props}
  />
}
