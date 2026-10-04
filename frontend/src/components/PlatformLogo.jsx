// Single source of truth for marketplace logos. Every logo in the app uses this
// component. Default size (md, 24px) is used in tables, chips and buttons;
// lg (48px) is used on the Integrations cards.
const SIZE_CLASSES = {
  md: 'w-6 h-6',
  lg: 'w-12 h-12'
};

const PIXELS = { md: 24, lg: 48 };

const PlatformLogo = ({ src, alt = '', size = 'md', className = '' }) => (
  <img
    src={src}
    alt={alt}
    width={PIXELS[size]}
    height={PIXELS[size]}
    className={`${SIZE_CLASSES[size]} object-contain shrink-0 ${className}`.trim()}
  />
);

export default PlatformLogo;
