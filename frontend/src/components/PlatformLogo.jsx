// Single source of truth for marketplace logos. Every logo in the app uses this
// component so they all render at the same size (24px) in tables, cards and buttons.
const PlatformLogo = ({ src, alt = '', className = '' }) => (
  <img
    src={src}
    alt={alt}
    width={24}
    height={24}
    className={`w-6 h-6 object-contain shrink-0 ${className}`.trim()}
  />
);

export default PlatformLogo;
