// Single source of truth for marketplace logos. Every logo is the full original
// artwork on the same white square, shown at the same size (40px) everywhere.
const SIZE = 40;

const PlatformLogo = ({ src, alt = '', className = '' }) => (
  <img
    src={src}
    alt={alt}
    width={SIZE}
    height={SIZE}
    className={`w-10 h-10 object-contain shrink-0 ${className}`.trim()}
  />
);

export default PlatformLogo;
