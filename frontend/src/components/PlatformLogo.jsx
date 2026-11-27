// Single component for marketplace logos. The whole artwork is always shown
// (object-contain, never cropped or zoomed). Each usage passes its own size class,
// so table, card and modal logos keep the sizes they had before.
const PlatformLogo = ({ src, alt = '', className = '' }) => (
  <img
    src={src}
    alt={alt}
    className={`object-contain ${className || 'w-6 h-6'}`.trim()}
  />
);

export default PlatformLogo;
