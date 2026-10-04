// Single source of truth for marketplace logos. Every logo in the app is the same
// size (40px), square, with no border, background or rounding of its own.
// Amazon's wordmark is wide, so it is fitted inside the square instead of cropped.
const SIZE = 40;

const PlatformLogo = ({ src, alt = '', className = '' }) => {
  const fit = /amazon/i.test(src) ? 'object-contain' : 'object-cover';
  return (
    <img
      src={src}
      alt={alt}
      width={SIZE}
      height={SIZE}
      className={`w-10 h-10 ${fit} shrink-0 ${className}`.trim()}
    />
  );
};

export default PlatformLogo;
