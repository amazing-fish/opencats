function CatIcon({ size = 24, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3.1-9-7.56c0-1.25.5-2.4 1.1-3.48 0 0-1.86-6.36-.5-6.94 1.36-.59 4.65.2 6.4 2.24.66-.17 1.34-.26 2-.26z" />
      <path d="M9 14.5c.5.5 1.5.5 2 0" />
      <path d="M15 14.5c-.5.5-1.5.5-2 0" />
    </svg>
  )
}

export default CatIcon
