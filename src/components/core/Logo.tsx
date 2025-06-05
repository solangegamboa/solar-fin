import type { SVGProps } from 'react';
import { Sun } from 'lucide-react';

const Logo = (props: SVGProps<SVGSVGElement>) => (
  <Sun aria-label="Solar Fin Logo" {...props} />
);

export default Logo;
